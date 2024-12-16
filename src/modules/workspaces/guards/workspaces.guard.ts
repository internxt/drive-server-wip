import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspacesUsecases } from '../workspaces.usecase';
import {
  AccessContext,
  AccessOptions,
  WorkspaceContextIdFieldName,
  WorkspaceRole,
} from './workspace-required-access.decorator';
import { User } from '../../user/user.domain';
import { isUUID } from 'class-validator';
import { WorkspaceLogType } from '../attributes/workspace-logs.attributes';
import { WorkspaceItemType } from '../attributes/workspace-items-users.attributes';

interface TrashItem {
  type: WorkspaceItemType;
  uuid: string;
}

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private workspaceUseCases: WorkspacesUsecases,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const accessOptions: AccessOptions = this.reflector.get(
      'accessControl',
      context.getHandler(),
    );

    if (!accessOptions) {
      return true;
    }

    const { requiredRole, accessContext, idSource } = accessOptions;

    const request = context.switchToHttp().getRequest();

    if (!request.user) {
      return false;
    }

    const user = User.build({ ...request.user });

    const id = this.getIdFromRequest(
      request,
      idSource,
      WorkspaceContextIdFieldName[accessContext],
    );

    if (!id || !isUUID(id)) {
      throw new BadRequestException(
        `${WorkspaceContextIdFieldName[accessContext]} should be a valid uuid!`,
      );
    }

    let verified = false;
    const workspaceLogAction =
      this.reflector.get('workspaceLogAction', context.getHandler()) || null;

    if (accessContext === AccessContext.WORKSPACE) {
      verified = await this.verifyWorkspaceAccessByRole(user, id, requiredRole);
    } else if (accessContext === AccessContext.TEAM) {
      verified = await this.verifyTeamAccessByRole(user, id, requiredRole);
    }

    if (verified && workspaceLogAction === WorkspaceLogType.DELETE_ALL) {
      const items: TrashItem[] = await this.getItems(user, id);
      request.items = items;
    }

    return verified;
  }

  private async verifyWorkspaceAccessByRole(
    user: User,
    workspaceId: string,
    role: WorkspaceRole,
  ) {
    const { workspace, workspaceUser } =
      await this.workspaceUseCases.findUserAndWorkspace(user.uuid, workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const isUserPartOfWorkspace = workspaceUser || workspace.isUserOwner(user);
    const isOwnerRoleRequiredButNotMet =
      role === WorkspaceRole.OWNER && !workspace.isUserOwner(user);
    const isWorkspaceNotSetupAndUserNotOwner =
      !workspace.isWorkspaceReady() && !workspace.isUserOwner(user);
    const isUserDeactivated = workspaceUser?.deactivated;

    if (
      !isUserPartOfWorkspace ||
      isOwnerRoleRequiredButNotMet ||
      isWorkspaceNotSetupAndUserNotOwner ||
      isUserDeactivated
    ) {
      Logger.log(
        `[WORKSPACES/GUARD]: Access denied. ID: ${workspaceId}, User UUID: ${user.uuid}`,
      );
      throw new ForbiddenException(
        'You do not have the required access to this workspace.',
      );
    }

    return true;
  }

  private async verifyTeamAccessByRole(
    user: User,
    teamId: string,
    role: WorkspaceRole,
  ) {
    const { team, teamUser } = await this.workspaceUseCases.findUserInTeam(
      user.uuid,
      teamId,
    );

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const { workspace, workspaceUser } =
      await this.workspaceUseCases.findUserAndWorkspace(
        user.uuid,
        team.workspaceId,
      );

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (!workspaceUser || workspaceUser?.deactivated) {
      throw new ForbiddenException(
        'You do not have the required access to this workspace.',
      );
    }

    if (workspace.isUserOwner(user)) {
      return true;
    }

    if (teamUser && role === WorkspaceRole.MANAGER) {
      return team.isUserManager(user);
    }

    if (teamUser && role === WorkspaceRole.MEMBER) {
      return true;
    }

    throw new ForbiddenException(
      'You do not have the required access to this team',
    );
  }

  private getIdFromRequest(
    request,
    source: 'params' | 'body' | 'query',
    field: string,
  ): string | undefined {
    return request[source]?.[field];
  }

  async getItems(user: User, workspaceId: string): Promise<TrashItem[]> {
    try {
      const { result: files } =
        await this.workspaceUseCases.getWorkspaceUserTrashedItems(
          user,
          workspaceId,
          WorkspaceItemType.File,
          null,
        );

      const { result: folders } =
        await this.workspaceUseCases.getWorkspaceUserTrashedItems(
          user,
          workspaceId,
          WorkspaceItemType.Folder,
          null,
        );

      const items: TrashItem[] = [
        ...(Array.isArray(files) ? files : [])
          .filter((file) => file.uuid != null)
          .map((file) => ({
            type: WorkspaceItemType.File,
            uuid: file.uuid,
          })),
        ...(Array.isArray(folders) ? folders : [])
          .filter((folder) => folder.uuid != null)
          .map((folder) => ({
            type: WorkspaceItemType.Folder,
            uuid: folder.uuid,
          })),
      ];

      return items;
    } catch (error) {
      Logger.debug('[WORKSPACES/GUARD] Error fetching trashed items:', error);
      return;
    }
  }
}
