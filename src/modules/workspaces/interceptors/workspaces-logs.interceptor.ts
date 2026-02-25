import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
  Logger,
} from '@nestjs/common';
import { type Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SequelizeWorkspaceRepository } from '../repositories/workspaces.repository';
import {
  type WorkspaceLogAttributes,
  WorkspaceLogPlatform,
  WorkspaceLogType,
  WorkspaceLogGlobalActionType,
} from '../attributes/workspace-logs.attributes';
import { type User } from '../../user/user.domain';
import { type DeleteItemDto } from './../../trash/dto/controllers/delete-item.dto';
import { WorkspaceItemType } from '../attributes/workspace-items-users.attributes';

type ActionHandler = {
  [key in WorkspaceLogType | WorkspaceLogGlobalActionType]: (
    platform: WorkspaceLogPlatform,
    req: any,
    res: any,
  ) => Promise<void>;
};

export interface TrashItem {
  id?: string;
  type: WorkspaceItemType;
  uuid: string;
}

@Injectable()
export class WorkspacesLogsInterceptor implements NestInterceptor {
  public actionHandler: ActionHandler;
  public logAction: WorkspaceLogType | WorkspaceLogGlobalActionType;

  constructor(
    private readonly workspaceRepository: SequelizeWorkspaceRepository,
  ) {
    this.actionHandler = {
      [WorkspaceLogType.Login]: this.logIn.bind(this),
      [WorkspaceLogType.ChangedPassword]: this.changedPassword.bind(this),
      [WorkspaceLogType.Logout]: this.logout.bind(this),
      [WorkspaceLogType.DeleteFile]: this.deleteFile.bind(this),
      [WorkspaceLogType.DeleteFolder]: this.deleteFolder.bind(this),
      [WorkspaceLogType.ShareFile]: this.shareFile.bind(this),
      [WorkspaceLogType.ShareFolder]: this.shareFolder.bind(this),
      [WorkspaceLogGlobalActionType.Share]: this.share.bind(this),
      [WorkspaceLogGlobalActionType.Delete]: this.delete.bind(this),
      [WorkspaceLogGlobalActionType.DeleteAll]: this.delete.bind(this),
    };
  }

  determinePlatform(client: string): WorkspaceLogPlatform | undefined {
    const platforms = {
      'drive-web': WorkspaceLogPlatform.Web,
      'drive-mobile': WorkspaceLogPlatform.Mobile,
      'drive-desktop': WorkspaceLogPlatform.Desktop,
    };
    return platforms[client];
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    this.logAction = this.getWorkspaceLogAction(context);

    if (
      !Object.values({
        ...WorkspaceLogType,
        ...WorkspaceLogGlobalActionType,
      }).includes(this.logAction)
    ) {
      Logger.debug(`[WORKSPACE/LOGS] Invalid log action: ${this.logAction}`);
      return next.handle();
    }

    const platform = this.determinePlatform(request.headers['internxt-client']);

    if (!platform) {
      Logger.error(
        `[WORKSPACE/LOGS] Platform not specified for log action: ${this.logAction}`,
      );
      return next.handle();
    }

    return next.handle().pipe(
      tap((res) => {
        this.handleAction(platform, this.logAction, request, res).catch((err) =>
          Logger.error(
            `[WORKSPACE/LOGS] Error logging action: ${
              err.message ?? err
            }. Platform: ${platform}, Action: ${this.logAction}.`,
          ),
        );
      }),
    );
  }

  async logIn(platform: WorkspaceLogPlatform, req: any, res: any) {
    await this.handleUserAction(platform, WorkspaceLogType.Login, req, res);
  }

  async changedPassword(platform: WorkspaceLogPlatform, req: any, res: any) {
    await this.handleUserAction(
      platform,
      WorkspaceLogType.ChangedPassword,
      req,
      res,
    );
  }

  async logout(platform: WorkspaceLogPlatform, req: any, res: any) {
    await this.handleUserAction(platform, WorkspaceLogType.Logout, req, res);
  }

  async share(platform: WorkspaceLogPlatform, req: any, res: any) {
    const itemType = this.getItemType(req);
    if (!itemType) {
      Logger.debug('[WORKSPACE/LOGS] The item type is required');
      return;
    }

    const action = this.getActionForGlobalLogType(
      WorkspaceLogGlobalActionType.Share,
      itemType as unknown as WorkspaceItemType,
    );
    if (action) {
      await this.handleUserWorkspaceAction(platform, action, req, res);
    }
  }

  async shareFile(platform: WorkspaceLogPlatform, req: any, res: any) {
    await this.handleUserWorkspaceAction(
      platform,
      WorkspaceLogType.ShareFile,
      req,
      res,
    );
  }

  async shareFolder(platform: WorkspaceLogPlatform, req: any, res: any) {
    await this.handleUserWorkspaceAction(
      platform,
      WorkspaceLogType.ShareFolder,
      req,
      res,
    );
  }

  async delete(platform: WorkspaceLogPlatform, req: any, res: any) {
    const items: DeleteItemDto[] | TrashItem[] = req?.body?.items ?? res?.items;
    if (!items || items.length === 0) {
      Logger.debug('[WORKSPACE/LOGS] The items are required');
      return;
    }

    const { ok, requesterUuid, workspaceId } = this.extractRequestData(req);

    if (ok) {
      const deletePromises = items
        .map((item: DeleteItemDto | TrashItem) => {
          const action = this.getActionForGlobalLogType(
            WorkspaceLogGlobalActionType.Delete,
            item.type as unknown as WorkspaceItemType,
          );
          if (action) {
            return this.logWorkspaceAction({
              workspaceId: workspaceId,
              creator: requesterUuid,
              type: action,
              platform,
              entityId: item.uuid || item?.id,
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
      WorkspaceLogType.DeleteFile,
      req,
      res,
    );
  }

  async deleteFolder(platform: WorkspaceLogPlatform, req: any, res: any) {
    await this.handleUserWorkspaceAction(
      platform,
      WorkspaceLogType.DeleteFolder,
      req,
      res,
    );
  }

  async handleAction(
    platform: WorkspaceLogPlatform,
    action: WorkspaceLogType | WorkspaceLogGlobalActionType,
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

  getWorkspaceLogAction(
    context: ExecutionContext,
  ): WorkspaceLogType | WorkspaceLogGlobalActionType {
    const handler = context.getHandler();
    return Reflect.getMetadata('workspaceLogAction', handler) ?? null;
  }

  async logWorkspaceAction(
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

  async fetchUserWorkspacesIds(uuid: string) {
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
    const user: User = res?.user ?? req?.user;

    if (!user?.uuid) {
      Logger.debug('[WORKSPACE/LOGS] User is required');
      return;
    }

    const workspaceIds = await this.fetchUserWorkspacesIds(user.uuid);
    await Promise.all(
      workspaceIds.map((workspaceId) =>
        this.logWorkspaceAction({
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
      await this.logWorkspaceAction({
        workspaceId,
        creator: requesterUuid,
        type: actionType,
        platform,
        entityId,
      });
    }
  }

  getItemType(req: any): string {
    return req?.body?.itemType ?? req?.params?.itemType;
  }

  getEntity(req: any, res: any): string {
    return req?.body?.itemId ?? req?.params?.itemId ?? res?.itemId;
  }

  getActionForGlobalLogType(
    type: WorkspaceLogGlobalActionType,
    itemType: WorkspaceItemType,
  ): WorkspaceLogType {
    const actionMap = {
      [WorkspaceLogGlobalActionType.Share]: {
        [WorkspaceItemType.File]: WorkspaceLogType.ShareFile,
        [WorkspaceItemType.Folder]: WorkspaceLogType.ShareFolder,
      },
      [WorkspaceLogGlobalActionType.Delete]: {
        [WorkspaceItemType.File]: WorkspaceLogType.DeleteFile,
        [WorkspaceItemType.Folder]: WorkspaceLogType.DeleteFolder,
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
      requester?.uuid ?? (params?.workspaceId ? user?.uuid : null);
    if (!requesterUuid) {
      Logger.debug('[WORKSPACE/LOGS] Requester not found');
    }
    const workspaceId = workspace?.id ?? params?.workspaceId;
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
