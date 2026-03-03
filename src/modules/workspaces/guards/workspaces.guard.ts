import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspacesUsecases } from '../workspaces.usecase';
import {
  AccessContext,
  type AccessOptions,
  WorkspaceContextIdFieldName,
  WorkspaceRole,
} from './workspace-required-access.decorator';
import { User } from '../../user/user.domain';
import { isUUID } from 'class-validator';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly workspaceUseCases: WorkspacesUsecases,
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

    if (accessContext === AccessContext.WORKSPACE) {
      return this.verifyWorkspaceAccessByRole(user, id, requiredRole);
    } else if (accessContext === AccessContext.TEAM) {
      return this.verifyTeamAccessByRole(user, id, requiredRole);
    }

    return false;
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
}
