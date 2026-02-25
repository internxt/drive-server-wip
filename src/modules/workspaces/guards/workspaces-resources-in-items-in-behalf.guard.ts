import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspacesUsecases } from '../workspaces.usecase';
import { User } from '../../user/user.domain';
import {
  WORKSPACE_IN_BEHALF_ACTION_META_KEY,
  WorkspaceResourcesAction,
} from './workspaces-resources-in-behalf.types';
import { type WorkspaceItemUser } from '../domains/workspace-item-user.domain';
import { verifyWithDefaultSecret } from '../../../lib/jwt';
import { isUUID } from 'class-validator';
import { extractDataFromRequest } from '../../../common/extract-data-from-request';
import { FeatureLimitService } from '../../feature-limit/feature-limit.service';

export interface DecodedWorkspaceToken {
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
    private readonly reflector: Reflector,
    private readonly workspaceUseCases: WorkspacesUsecases,
    private readonly featureLimitService: FeatureLimitService,
  ) {}

  protected actionHandlers: ActionHandlers = {
    [WorkspaceResourcesAction.AddItemsToTrash]:
      this.hasUserTrashPermissions.bind(this),
    [WorkspaceResourcesAction.DeleteItemsFromTrash]:
      this.hasUserTrashPermissions.bind(this),
    [WorkspaceResourcesAction.ModifySharingById]:
      this.hasUserAccessToSharing.bind(this),
    [WorkspaceResourcesAction.Default]: this.hasUserPermissions.bind(this),
  };

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

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
    const extractedData = extractDataFromRequest(
      request,
      this.reflector,
      context,
    );

    const { workspace, workspaceUser } =
      await this.workspaceUseCases.findUserAndWorkspace(
        requester.uuid,
        decodedToken.workspaceId,
      );

    if (!workspaceUser || workspaceUser?.deactivated) {
      throw new ForbiddenException('You can not access this workspace');
    }

    const actionHandler = this.getActionHandler(action);

    const bypassActionCheck = request.isSharedItem;

    const canUserPerformAction = bypassActionCheck
      ? true
      : await actionHandler(requester, extractedData);

    if (!canUserPerformAction) {
      throw new ForbiddenException(
        'You are trying to access items you have not created',
      );
    }

    const behalfUser =
      await this.workspaceUseCases.findWorkspaceResourceOwner(workspace);

    request.user = behalfUser;
    request.requester = requester;
    request.workspace = workspace;

    if (behalfUser.tierId && request.authInfo) {
      const tier = await this.featureLimitService.getTier(behalfUser.tierId);
      request.authInfo.tier = tier;
    }

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

  async hasUserAccessToSharing(requester: User, data: any): Promise<boolean> {
    const { sharingId } = data;

    const item =
      await this.workspaceUseCases.getWorkspaceItemBySharingId(sharingId);

    return !!item?.isOwnedBy(requester);
  }

  private decodeWorkspaceToken(token: string): DecodedWorkspaceToken {
    try {
      const decoded = verifyWithDefaultSecret(token) as DecodedWorkspaceToken;
      if (!decoded?.workspaceId) {
        throw new Error();
      }
      return decoded;
    } catch {
      throw new BadRequestException('Invalid workspace token!');
    }
  }

  protected getActionHandler(action: WorkspaceResourcesAction) {
    const actionHandler =
      this.actionHandlers[action ?? WorkspaceResourcesAction.Default];
    if (!actionHandler) {
      throw new Error(
        `There was an error setting the guard for workspaces resources! action: ${action} is invalid  `,
      );
    }
    return actionHandler;
  }
}
