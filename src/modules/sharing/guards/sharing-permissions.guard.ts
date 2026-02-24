import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type User } from '../../user/user.domain';
import { UserUseCases } from '../../user/user.usecase';
import { verifyWithDefaultSecret } from '../../../lib/jwt';
import { SharingService } from '../../sharing/sharing.service';
import {
  SharedWithType,
  type SharingActionName,
} from '../../sharing/sharing.domain';
import {
  PermissionsMetadataName,
  type PermissionsOptions,
} from './sharing-permissions.decorator';
import { type Workspace } from '../../workspaces/domains/workspaces.domain';
import { type Folder } from '../../folder/folder.domain';
import { WorkspacesUsecases } from '../../workspaces/workspaces.usecase';
import { extractDataFromRequest } from '../../../common/extract-data-from-request';
import { type SharingAccessTokenData } from './sharings-token.interface';

@Injectable()
export class SharingPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userUseCases: UserUseCases,
    private readonly sharingUseCases: SharingService,
    private readonly workspaceUseCases: WorkspacesUsecases,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissionsOptions: PermissionsOptions = this.reflector.get(
      PermissionsMetadataName,
      context.getHandler(),
    );

    const request = context.switchToHttp().getRequest();
    const requester = request?.user as User;

    if (!requester) {
      return false;
    }

    const resourcesToken = request.headers['internxt-resources-token'];

    if (
      !resourcesToken ||
      typeof resourcesToken !== 'string' ||
      !permissionsOptions
    ) {
      return true;
    }

    const { action } = permissionsOptions;

    const decoded = verifyWithDefaultSecret(resourcesToken) as
      | SharingAccessTokenData
      | string;

    if (typeof decoded === 'string') {
      throw new ForbiddenException('Invalid token');
    }

    const isRootToken = decoded.isSharedItem;

    let userIsAllowedToPerfomAction = false;

    const sharedItemId = isRootToken
      ? this.getSharedDataFromRequest(request, context)?.itemUuid
      : decoded.sharedRootFolderId;
    const workspaceId = decoded.workspace?.workspaceId || decoded.workspaceId;

    if (!sharedItemId) {
      throw new ForbiddenException('Shared item id not found');
    }

    if (workspaceId) {
      userIsAllowedToPerfomAction =
        await this.isWorkspaceMemberAbleToPerfomAction(
          requester,
          workspaceId,
          sharedItemId,
          action,
        );
    } else {
      userIsAllowedToPerfomAction = await this.isUserAbleToPerfomAction(
        requester,
        sharedItemId,
        action,
      );
    }

    if (!userIsAllowedToPerfomAction) {
      throw new ForbiddenException('You cannot access this resource');
    }

    if (!isRootToken && !decoded.owner?.uuid) {
      throw new ForbiddenException('Owner is required');
    }

    const resourceOwner = isRootToken
      ? await this.getOwnerByItemUuid(sharedItemId)
      : await this.userUseCases.findByUuid(decoded.owner.uuid);

    if (!resourceOwner) {
      throw new NotFoundException('Resource owner not found');
    }

    request.user = resourceOwner;
    request.requester = request.requester ?? request.user;
    request.isSharedItem = true;

    return true;
  }

  async isWorkspaceMemberAbleToPerfomAction(
    requester: User,
    workspaceId: Workspace['id'],
    sharedRootFolderId: Folder['uuid'],
    action: SharingActionName,
  ) {
    const teamsUserBelongsTo =
      await this.workspaceUseCases.getTeamsUserBelongsTo(
        requester.uuid,
        workspaceId,
      );

    const teamsIds = teamsUserBelongsTo.map((team) => team.id);

    const userIsAllowedToPerfomAction =
      await this.sharingUseCases.canPerfomAction(
        teamsIds,
        sharedRootFolderId,
        action,
        SharedWithType.WorkspaceTeam,
      );

    return userIsAllowedToPerfomAction;
  }

  async isUserAbleToPerfomAction(
    requester: User,
    sharedRootFolderId: Folder['uuid'],
    action: SharingActionName,
  ) {
    const userIsAllowedToPerfomAction =
      await this.sharingUseCases.canPerfomAction(
        requester.uuid,
        sharedRootFolderId,
        action,
        SharedWithType.Individual,
      );

    return userIsAllowedToPerfomAction;
  }

  async getOwnerByItemUuid(itemUuid: string) {
    const sharing = await this.sharingUseCases.findSharingBy({
      itemId: itemUuid,
    });
    if (!sharing) {
      throw new Error('Sharing item not found');
    }
    return this.userUseCases.getUser(sharing.ownerId);
  }

  getSharedDataFromRequest(request: Request, context: ExecutionContext) {
    return extractDataFromRequest(request, this.reflector, context) as any;
  }
}
