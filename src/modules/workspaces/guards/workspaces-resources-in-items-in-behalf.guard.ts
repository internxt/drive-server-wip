import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspacesUsecases } from '../workspaces.usecase';
import { User } from '../../user/user.domain';
import {
  WORKSPACE_IN_BEHALF_ACTION_META_KEY,
  WorkspaceResourcesAction,
} from './workspaces-resources-in-behalf.decorator';
import { WorkspaceItemUser } from '../domains/workspace-item-user.domain';
import { verifyWithDefaultSecret } from '../../../lib/jwt';
import { isUUID } from 'class-validator';
import { extractDataFromRequest } from '../../../common/extract-data-from-request';
import { SharedWithType } from './../../sharing/sharing.domain';
import { UserUseCases } from './../../user/user.usecase';
import { SharingService } from './../../sharing/sharing.service';
import { Folder } from './../../folder/folder.domain';
import { FolderUseCases } from './../../folder/folder.usecase';
import { FileUseCases } from './../../file/file.usecase';
import { Workspace } from '../domains/workspaces.domain';

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

type ActionHandler = (
  requester: User,
  data: ExtractedData,
  workspaceId?: Workspace['id'],
) => Promise<boolean>;

type ActionHandlers = Record<WorkspaceResourcesAction, ActionHandler>;

@Injectable()
export class WorkspacesResourcesItemsInBehalfGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private workspaceUseCases: WorkspacesUsecases,
    private sharingUseCases: SharingService,
    private folderUseCases: FolderUseCases,
    private fileUseCases: FileUseCases,
    private userUseCases: UserUseCases,
  ) {}

  protected actionHandlers: ActionHandlers = {
    [WorkspaceResourcesAction.AddItemsToTrash]:
      this.hasUserTrashPermissions.bind(this),
    [WorkspaceResourcesAction.DeleteItemsFromTrash]:
      this.hasUserTrashPermissions.bind(this),
    [WorkspaceResourcesAction.ModifySharingById]:
      this.hasUserAccessToSharing.bind(this),
    [WorkspaceResourcesAction.ViewItemDetails]:
      this.hasUserAccessToViewSharedItemDetails.bind(this),
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
    const extractedData: ExtractedData = extractDataFromRequest(
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
      : await actionHandler(requester, extractedData, workspace.id);

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

  async hasUserAccessToViewSharedItemDetails(
    requester: User,
    item: {
      itemId: WorkspaceItemUser['itemId'];
      itemType: WorkspaceItemUser['itemType'];
    },
    workspaceId: Workspace['id'],
  ): Promise<boolean> {
    const { itemId, itemType } = item;

    if (!isUUID(itemId) || !isUUID(workspaceId)) {
      throw new BadRequestException('You need to send a valid UUID');
    }

    if (await this.isSharedDirectlyWithUserTeam(requester, itemId, itemType)) {
      return true;
    }

    return await this.isSharedThroughParentFoldersWithUserTeam(
      requester,
      itemId,
      itemType,
      workspaceId,
    );
  }

  async isSharedDirectlyWithUserTeam(
    requester: User,
    itemId: WorkspaceItemUser['itemId'],
    itemType: WorkspaceItemUser['itemType'],
  ): Promise<boolean> {
    const sharings = await this.sharingUseCases.findAllSharingsByItemIds(
      [itemId],
      { itemType },
    );
    const sharedWithTeams = sharings
      .filter((s) => s.sharedWithType === SharedWithType.WorkspaceTeam)
      .map((s) => s.sharedWith);

    for (const teamUuid of sharedWithTeams) {
      const teamMembers = await this.workspaceUseCases.getTeamMembers(teamUuid);
      if (teamMembers.map((m) => m.uuid).includes(requester.uuid)) {
        return true;
      }
    }
    return false;
  }

  async isSharedThroughParentFoldersWithUserTeam(
    requester: User,
    itemId: string,
    itemType: string,
    workspaceId: Workspace['id'],
  ): Promise<boolean> {
    let folderUuid: string | null = null;

    if (itemType === 'file') {
      const file = await this.fileUseCases.getByUuid(itemId);
      folderUuid = file ? file.folderUuid : null;
    } else if (itemType === 'folder') {
      folderUuid = itemId;
    }

    if (!folderUuid) {
      return false;
    }

    const folder = await this.folderUseCases.getByUuid(folderUuid);
    const folderUser = await this.userUseCases.findById(folder.userId);
    const parentFolders =
      await this.folderUseCases.getFolderAncestorsInWorkspace(
        folderUser,
        folderUuid,
      );
    const parentFoldersUuid = parentFolders.map((f: Folder) => f.uuid);

    const sharingsFoundByItemIds =
      await this.sharingUseCases.findAllSharingsByItemIds(parentFoldersUuid, {
        sharedWithType: SharedWithType.WorkspaceTeam,
      });
    const sharedWithTeamUuids = new Set(
      sharingsFoundByItemIds.map((s) => s.sharedWith),
    );

    const requesterTeams = await this.workspaceUseCases.getTeamsUserBelongsTo(
      requester.uuid,
      workspaceId,
    );
    const requesterTeamUuids = new Set(requesterTeams.map((t) => t.id));

    return [...sharedWithTeamUuids].some((uuid) =>
      requesterTeamUuids.has(uuid),
    );
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
