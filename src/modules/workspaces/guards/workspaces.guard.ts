// flexible-access.guard.ts
import {
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
      await this.workspaceUseCases.findUserInWorkspace(user.uuid, workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const isUserNotInWorkspace = !workspaceUser;
    const isRequiredOwnerRoleAndUserIsNotOwner =
      role === WorkspaceRole.OWNER && !workspace.isUserOwner(user);

    if (isUserNotInWorkspace || isRequiredOwnerRoleAndUserIsNotOwner) {
      Logger.log(
        `[WORKSPACES/GUARD]: user has no requiered access to workspace. id: ${workspaceId} userUuid: ${user.uuid} `,
      );
      throw new ForbiddenException('You have no access to this workspace');
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

    const workspace = await this.workspaceUseCases.findById(team.workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
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

    throw new ForbiddenException('You have no access to this team');
  }

  private getIdFromRequest(
    request,
    source: 'params' | 'body' | 'query',
    field: string,
  ): string | undefined {
    return request[source]?.[field];
  }
}
