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
    const user = request.user;

    const id = this.getIdFromRequest(
      request,
      idSource,
      WorkspaceContextIdFieldName[accessContext],
    );

    if (accessContext === AccessContext.WORKSPACE) {
      return this.checkUserWorkspaceRole(user.uuid, id, requiredRole);
    } else if (accessContext === AccessContext.TEAM) {
      return this.checkUserTeamRole(user.uuid, id, requiredRole);
    }

    return false;
  }

  private async checkUserWorkspaceRole(
    userUuid: string,
    workspaceId: string,
    role: WorkspaceRole,
  ) {
    const { workspace, workspaceUser } =
      await this.workspaceUseCases.findUserInWorkspace(userUuid, workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (
      !workspaceUser ||
      !(role === WorkspaceRole.OWNER && workspace.isUserOwner(userUuid))
    ) {
      Logger.log(
        `[WORKSPACES/GUARD]: user has no requiered access to workspace. id: ${workspaceId} userUuid: ${userUuid} `,
      );
      throw new ForbiddenException('You have no access to this workspace');
    }

    return !!workspaceUser;
  }

  private async checkUserTeamRole(
    userUuid: string,
    teamId: string,
    role: WorkspaceRole,
  ) {
    const { team, teamUser } = await this.workspaceUseCases.findUserInTeam(
      userUuid,
      teamId,
    );

    const workspace = await this.workspaceUseCases.findById(team.workspaceId);
    if (workspace.isUserOwner(userUuid)) {
      return true;
    }

    if (teamUser && role === WorkspaceRole.MANAGER) {
      return team.isUserManager(userUuid);
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
