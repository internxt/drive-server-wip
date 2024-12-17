import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { SequelizeWorkspaceRepository } from '../repositories/workspaces.repository';
import {
  WorkspaceLogAttributes,
  WorkspaceLogPlatform,
  WorkspaceLogType,
} from '../attributes/workspace-logs.attributes';
import { User } from '../../user/user.domain';
import { DeleteItem } from './../../trash/dto/controllers/delete-item.dto';
import { WorkspaceItemType } from '../attributes/workspace-items-users.attributes';

type ActionHandler = {
  [key in WorkspaceLogType]: (
    platform: WorkspaceLogPlatform,
    req: any,
    res: any,
  ) => Promise<void>;
};

@Injectable()
export class WorkspacesLogsInterceptor implements NestInterceptor {
  public actionHandler: ActionHandler;
  public logAction: WorkspaceLogType;

  constructor(
    private readonly workspaceRepository: SequelizeWorkspaceRepository,
  ) {
    this.actionHandler = {
      [WorkspaceLogType.LOGIN]: this.logIn.bind(this),
      [WorkspaceLogType.CHANGED_PASSWORD]: this.changedPassword.bind(this),
      [WorkspaceLogType.LOGOUT]: this.logout.bind(this),
      [WorkspaceLogType.DELETE]: this.delete.bind(this),
      [WorkspaceLogType.DELETE_ALL]: this.delete.bind(this),
      [WorkspaceLogType.DELETE_FILE]: this.deleteFile.bind(this),
      [WorkspaceLogType.DELETE_FOLDER]: this.deleteFolder.bind(this),
      [WorkspaceLogType.SHARE]: this.share.bind(this),
      [WorkspaceLogType.SHARE_FILE]: this.shareFile.bind(this),
      [WorkspaceLogType.SHARE_FOLDER]: this.shareFolder.bind(this),
    };
  }

  determinePlatform(client: string): WorkspaceLogPlatform {
    const platforms = {
      'drive-web': WorkspaceLogPlatform.WEB,
      'drive-mobile': WorkspaceLogPlatform.MOBILE,
      'drive-desktop': WorkspaceLogPlatform.DESKTOP,
    };
    return platforms[client] || WorkspaceLogPlatform.UNSPECIFIED;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    this.logAction = this.getWorkspaceLogAction(context);

    if (!Object.values(WorkspaceLogType).includes(this.logAction)) {
      Logger.debug(`[WORKSPACE/LOGS] Invalid log action: ${this.logAction}`);
      return;
    }

    const platform = this.determinePlatform(request.headers['internxt-client']);

    return next.handle().pipe(
      mergeMap(async (res) => {
        await this.handleAction(platform, this.logAction, request, res);
      }),
    );
  }

  async logIn(platform: WorkspaceLogPlatform, req: any, res: any) {
    await this.handleUserAction(platform, WorkspaceLogType.LOGIN, req, res);
  }

  async changedPassword(platform: WorkspaceLogPlatform, req: any, res: any) {
    await this.handleUserAction(
      platform,
      WorkspaceLogType.CHANGED_PASSWORD,
      req,
      res,
    );
  }

  async logout(platform: WorkspaceLogPlatform, req: any, res: any) {
    await this.handleUserAction(platform, WorkspaceLogType.LOGOUT, req, res);
  }

  async share(platform: WorkspaceLogPlatform, req: any, res: any) {
    const itemType = this.getItemType(req);
    if (!itemType) {
      Logger.debug('[WORKSPACE/LOGS] The item type is required');
      return;
    }

    const action = this.determineAction(
      'SHARE',
      itemType as unknown as WorkspaceItemType,
    );
    if (action) {
      await this.handleUserWorkspaceAction(platform, action, req, res);
    }
  }

  async shareFile(platform: WorkspaceLogPlatform, req: any, res: any) {
    await this.handleUserWorkspaceAction(
      platform,
      WorkspaceLogType.SHARE_FILE,
      req,
      res,
    );
  }

  async shareFolder(platform: WorkspaceLogPlatform, req: any, res: any) {
    await this.handleUserWorkspaceAction(
      platform,
      WorkspaceLogType.SHARE_FOLDER,
      req,
      res,
    );
  }

  async delete(platform: WorkspaceLogPlatform, req: any, res: any) {
    const items: DeleteItem[] = req?.body?.items || req?.items;
    if (!items || items.length === 0) {
      Logger.debug('[WORKSPACE/LOGS] The items are required');
      return;
    }

    const { ok, requesterUuid, workspaceId } = this.extractRequestData(req);

    if (ok) {
      const deletePromises = items
        .map((item) => {
          const action = this.determineAction(
            'DELETE',
            item.type as unknown as WorkspaceItemType,
          );
          if (action) {
            return this.registerWorkspaceLog({
              workspaceId: workspaceId,
              creator: requesterUuid,
              type: action,
              platform,
              entityId: item.uuid || item.id,
            });
          }
          return null;
        })
        .filter((promise): promise is Promise<any> => promise !== null);
      await Promise.all(deletePromises);
    }
  }

  async deleteFile(platform: WorkspaceLogPlatform, req: any, res: any) {
    await this.handleUserWorkspaceAction(
      platform,
      WorkspaceLogType.DELETE_FILE,
      req,
      res,
    );
  }

  async deleteFolder(platform: WorkspaceLogPlatform, req: any, res: any) {
    await this.handleUserWorkspaceAction(
      platform,
      WorkspaceLogType.DELETE_FOLDER,
      req,
      res,
    );
  }

  async handleAction(
    platform: WorkspaceLogPlatform,
    action: WorkspaceLogType,
    req: any,
    res: any,
  ) {
    const dispatchAction = this.actionHandler[action];
    if (dispatchAction) {
      await dispatchAction(platform, req, res);
    } else {
      Logger.debug(`[WORKSPACE/LOGS] Action not recognized: ${action}`);
    }
  }

  getWorkspaceLogAction(context: ExecutionContext): WorkspaceLogType {
    const handler = context.getHandler();
    return Reflect.getMetadata('workspaceLogAction', handler) || null;
  }

  async registerWorkspaceLog(
    payload: Omit<WorkspaceLogAttributes, 'id' | 'createdAt' | 'updatedAt'>,
  ) {
    try {
      await this.workspaceRepository.registerLog({
        ...payload,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      Logger.debug(
        `[WORKSPACE/LOGS] An error occurred trying to register a log of type ${payload.type} for the user ${payload.creator}`,
        error,
      );
    }
  }

  async getUserWorkspaces(uuid: string) {
    const availableWorkspaces =
      await this.workspaceRepository.findUserAvailableWorkspaces(uuid);
    return availableWorkspaces
      .filter(
        ({ workspace, workspaceUser }) =>
          workspace.isWorkspaceReady() && !workspaceUser.deactivated,
      )
      .map(({ workspace }) => workspace.id);
  }

  async handleUserAction(
    platform: WorkspaceLogPlatform,
    actionType: WorkspaceLogType,
    req: any,
    res: any,
  ) {
    const user: User = res?.user || req?.user;

    if (!user?.uuid) {
      Logger.debug('[WORKSPACE/LOGS] User is required');
      return;
    }

    const workspaceIds = await this.getUserWorkspaces(user.uuid);
    await Promise.all(
      workspaceIds.map((workspaceId) =>
        this.registerWorkspaceLog({
          workspaceId,
          creator: user.uuid,
          type: actionType,
          platform,
        }),
      ),
    );
  }

  async handleUserWorkspaceAction(
    platform: WorkspaceLogPlatform,
    actionType: WorkspaceLogType,
    req: any,
    res: any,
    entity?: string,
  ) {
    const { ok, requesterUuid, workspaceId } = this.extractRequestData(req);

    const entityId = entity || this.getEntity(req, res);
    if (!entityId) {
      Logger.debug('[WORKSPACE/LOGS] Item Id is required');
    }

    if (ok && requesterUuid && workspaceId && entityId) {
      await this.registerWorkspaceLog({
        workspaceId,
        creator: requesterUuid,
        type: actionType,
        platform,
        entityId,
      });
    }
  }

  getItemType(req: any): string {
    return req?.body?.itemType || req?.params?.itemType;
  }

  getEntity(req: any, res: any): string {
    return req?.body?.itemId || req?.params?.itemId || res?.itemId;
  }

  determineAction(
    type: 'SHARE' | 'DELETE',
    itemType: WorkspaceItemType,
  ): WorkspaceLogType {
    const actionMap = {
      SHARE: {
        [WorkspaceItemType.File]: WorkspaceLogType.SHARE_FILE,
        [WorkspaceItemType.Folder]: WorkspaceLogType.SHARE_FOLDER,
      },
      DELETE: {
        [WorkspaceItemType.File]: WorkspaceLogType.DELETE_FILE,
        [WorkspaceItemType.Folder]: WorkspaceLogType.DELETE_FOLDER,
      },
    };

    const action = actionMap[type]?.[itemType];

    if (!action) {
      Logger.debug(
        `[WORKSPACE/LOGS] Invalid action type: ${type} or item type: ${itemType}`,
      );
      return null;
    }

    return action;
  }

  extractRequestData(req: any) {
    const { params, requester, workspace, user } = req;

    const requesterUuid =
      requester?.uuid || (params?.workspaceId ? user?.uuid : null);
    if (!requesterUuid) {
      Logger.debug('[WORKSPACE/LOGS] Requester not found');
    }
    const workspaceId = workspace?.id || params?.workspaceId;
    if (!workspaceId) {
      Logger.debug('[WORKSPACE/LOGS] Workspace is required');
    }

    const ok = !!(requesterUuid && workspaceId);

    return {
      ok,
      requesterUuid,
      workspaceId,
    };
  }
}
