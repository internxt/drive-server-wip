import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '../../user/user.domain';
import { UserUseCases } from '../../user/user.usecase';
import { verifyWithDefaultSecret } from '../../../lib/jwt';
import { SharingService } from '../../sharing/sharing.service';
import {
  SharedWithType,
  SharingActionName,
} from '../../sharing/sharing.domain';
import {
  PermissionsMetadataName,
  PermissionsOptions,
} from './sharing-permissions.decorator';
import { Workspace } from '../../workspaces/domains/workspaces.domain';
import { Folder } from '../../folder/folder.domain';
import { WorkspacesUsecases } from '../../workspaces/workspaces.usecase';
import { extractDataFromRequest } from '../../../common/extract-data-from-request';
import { SharingAccessTokenData } from './sharings-token.interface';

@Injectable()
export class SharingPermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userUseCases: UserUseCases,
    private sharingUseCases: SharingService,
    private workspaceUseCases: WorkspacesUsecases,
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

    let userIsAllowedToPerfomAction = false;

    const sharedItemId = decoded.sharedRootFolderId;

    if (decoded.workspace) {
      userIsAllowedToPerfomAction =
        await this.isWorkspaceMemberAbleToPerfomAction(
          requester,
          decoded.workspace.workspaceId,
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
      return false;
    }

    const resourceOwner = await this.userUseCases.findByUuid(
      decoded.owner.uuid,
    );

    if (!resourceOwner) {
      throw new NotFoundException('Resource owner not found');
    }

    request.user = resourceOwner;
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

  getSharedItemIdFromRequest(
    request: Request,
    reflector: Reflector,
    context: ExecutionContext,
  ) {
    const extractedData = extractDataFromRequest(
      request,
      reflector,
      context,
    ) as any;

    return extractedData.itemId;
  }
}
