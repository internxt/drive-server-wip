import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspacesUsecases } from '../workspaces.usecase';
import { User } from '../../user/user.domain';
import {
  WORKSPACE_IN_BEHALF_SOURCES_META_KEY,
  DataSource,
  WORKSPACE_IN_BEHALF_ACTION_META_KEY,
  WorkspaceResourcesAction,
} from './workspaces-resources-in-behalf.decorator';
import { WorkspaceItemUser } from '../domains/workspace-item-user.domain';
import { verifyWithDefaultSecret } from '../../../lib/jwt';
import { isUUID } from 'class-validator';

interface DecodedToken {
  workspaceId: string;
}

interface ExtractedData {
  items?: {
    itemId: WorkspaceItemUser['itemId'];
    itemType: WorkspaceItemUser['itemType'];
  }[];
  [key: string]: any;
}

type ActionHandler = (requester: User, data: ExtractedData) => Promise<boolean>;

type ActionHandlers = Record<WorkspaceResourcesAction, ActionHandler>;

@Injectable()
export class WorkspacesResourcesItemsInBehalfGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private workspaceUseCases: WorkspacesUsecases,
  ) {}

  private actionHandlers: ActionHandlers = {
    [WorkspaceResourcesAction.AddItemsToTrash]:
      this.hasUserTrashPermissions.bind(this),
    [WorkspaceResourcesAction.Default]: this.hasUserPermissions.bind(this),
  };

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const dataSources = this.reflector.get<DataSource[]>(
      WORKSPACE_IN_BEHALF_SOURCES_META_KEY,
      context.getHandler(),
    );
    const action = this.reflector.get<WorkspaceResourcesAction>(
      WORKSPACE_IN_BEHALF_ACTION_META_KEY,
      context.getHandler(),
    );

    if (!request.user) {
      return false;
    }

    const workspaceHeaderToken = request.headers['x-internxt-workspace'];

    if (!workspaceHeaderToken) {
      return true;
    }

    const decodedToken = this.decodeWorkspaceToken(workspaceHeaderToken);

    const requester = User.build({ ...request.user });

    const extractedData = this.extractDataFromRequest(request, dataSources);

    const { workspace, workspaceUser } =
      await this.workspaceUseCases.findUserAndWorkspace(
        requester.uuid,
        decodedToken.workspaceId,
      );

    if (!workspaceUser || workspaceUser?.deactivated) {
      throw new ForbiddenException('You can not access this workspace');
    }

    const actionHandler =
      this.actionHandlers[action ?? WorkspaceResourcesAction.Default];

    if (!actionHandler) {
      throw new Error(
        `There was an error setting the guard for workspaces resources! action: ${action} is invalid  `,
      );
    }

    const canUserPerformAction = await actionHandler(requester, extractedData);

    if (!canUserPerformAction) {
      throw new ForbiddenException(
        'You are trying to access items you have not created',
      );
    }

    const behalfUser =
      this.workspaceUseCases.findWorkspaceResourceOwner(workspace);

    request.user = behalfUser;
    request.requester = requester;

    return true;
  }

  async hasUserPermissions(
    requester: User,
    item: {
      itemId: WorkspaceItemUser['itemId'];
      itemType: WorkspaceItemUser['itemType'];
    },
  ) {
    if (!isUUID(item?.itemId)) {
      throw new BadRequestException('You need to send a valid UUID');
    }

    return this.workspaceUseCases.isUserCreatorOfItem(
      requester,
      item.itemId,
      item.itemType,
    );
  }

  async hasUserTrashPermissions(requester: User, data: any): Promise<boolean> {
    const { items } = data;

    const itemsToCheck: {
      itemId: WorkspaceItemUser['itemId'];
      itemType: WorkspaceItemUser['itemType'];
    }[] = [];

    for (const item of items) {
      const { uuid, type } = item;

      if (!isUUID(uuid)) {
        throw new BadRequestException(
          'You need send a valid uuid for all items',
        );
      }

      itemsToCheck.push({ itemId: uuid, itemType: type });
    }

    const isCreator = await this.workspaceUseCases.isUserCreatorOfAllItems(
      requester,
      itemsToCheck,
    );

    return isCreator;
  }

  extractDataFromRequest(request: Request, dataSources: DataSource[]) {
    const extractedData = {};

    for (const { sourceKey, fieldName, value, newFieldName } of dataSources) {
      const extractedValue =
        value !== undefined ? value : request[sourceKey][fieldName];

      const isValueUndefined =
        extractedValue === undefined || extractedValue === null;

      if (isValueUndefined) {
        new Logger().error(
          `[WORKSPACES_BEHALF_GUARD]: Missing required field to validate user access to resource! field: ${fieldName}`,
        );
        throw new BadRequestException(`Missing required field: ${fieldName}`);
      }

      const targetFieldName = newFieldName ? newFieldName : fieldName;

      extractedData[targetFieldName] = extractedValue;
    }

    return extractedData;
  }

  private decodeWorkspaceToken(token: string): DecodedToken {
    try {
      const decoded = verifyWithDefaultSecret(token) as DecodedToken;
      if (!decoded?.workspaceId) {
        throw new Error();
      }
      return decoded;
    } catch {
      throw new BadRequestException('Invalid workspace token!');
    }
  }
}
