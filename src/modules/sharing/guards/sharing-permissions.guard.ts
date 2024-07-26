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
import { FolderAttributes } from '../../folder/folder.attributes';
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
import { WorkspaceTeam } from '../../workspaces/domains/workspace-team.domain';
import { Folder } from '../../folder/folder.domain';
import { WorkspacesUsecases } from '../../workspaces/workspaces.usecase';

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
      | {
          owner?: {
            uuid?: User['uuid'];
          };
          sharedRootFolderId?: FolderAttributes['uuid'];
          sharedWithType: SharedWithType;
          workspace?: {
            workspaceId: Workspace['id'];
            teamId: WorkspaceTeam['id'];
          };
        }
      | string;

    if (typeof decoded === 'string') {
      throw new ForbiddenException('Invalid token');
    }

    let userIsAllowedToPerfomAction = false;

    if (decoded.workspace) {
      userIsAllowedToPerfomAction = await this.isTeamMemberAbleToPerformAction(
        requester,
        decoded.workspace.teamId,
        decoded.sharedRootFolderId,
        action,
      );
    } else {
      userIsAllowedToPerfomAction = await this.isUserAbleToPerfomAction(
        requester,
        decoded.sharedRootFolderId,
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

  async isTeamMemberAbleToPerformAction(
    requester: User,
    teamId: WorkspaceTeam['id'],
    sharedRootFolderId: Folder['uuid'],
    action: SharingActionName,
  ) {
    const [userIsAllowedToPerfomAction, isUserPartOfTeam] = await Promise.all([
      this.sharingUseCases.canPerfomAction(
        requester.uuid,
        sharedRootFolderId,
        action,
        SharedWithType.WorkspaceTeam,
      ),
      this.workspaceUseCases.findUserInTeam(requester.uuid, teamId),
    ]);

    return userIsAllowedToPerfomAction && !!isUserPartOfTeam?.teamUser;
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
}
