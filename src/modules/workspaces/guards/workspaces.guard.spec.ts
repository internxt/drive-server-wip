import { type DeepMocked, createMock } from '@golevelup/ts-jest';
import {
  BadRequestException,
  type ExecutionContext,
  ForbiddenException,
  type Logger,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceGuard } from './workspaces.guard';
import { WorkspacesUsecases } from '../workspaces.usecase';
import {
  AccessContext,
  WorkspaceRole,
} from './workspace-required-access.decorator';
import {
  newUser,
  newWorkspace,
  newWorkspaceTeam,
  newWorkspaceUser,
} from '../../../../test/fixtures';
import { type WorkspaceUser } from '../domains/workspace-user.domain';
import { type WorkspaceTeamUser } from '../domains/workspace-team-user.domain';
import { v4 } from 'uuid';
import { Test, type TestingModule } from '@nestjs/testing';

describe('WorkspaceGuard', () => {
  let guard: WorkspaceGuard;
  let reflector: DeepMocked<Reflector>;
  let workspaceUseCases: DeepMocked<WorkspacesUsecases>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkspaceGuard],
    })
      .useMocker(createMock)
      .setLogger(createMock<Logger>())
      .compile();

    guard = module.get(WorkspaceGuard);
    reflector = module.get(Reflector);
    workspaceUseCases = module.get(WorkspacesUsecases);
  });

  it('Guard should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('When there is no metadata set, then bypass guard', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);

    const context = createMockExecutionContext(null, null);

    const canUserAccess = await guard.canActivate(context);

    expect(canUserAccess).toBeTruthy();
  });

  it('When there is no user set, then block access', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      requiredRole: WorkspaceRole.OWNER,
      accessContext: AccessContext.WORKSPACE,
      idSource: 'params',
    });
    const context = createMockExecutionContext(null, null);

    const canUserAccess = await guard.canActivate(context);

    expect(canUserAccess).toBeFalsy();
  });

  describe('Workspace Permissions', () => {
    it('When workspace id is not valid, then throw ', async () => {
      const user = newUser();

      jest.spyOn(reflector, 'get').mockReturnValue({
        requiredRole: WorkspaceRole.MEMBER,
        accessContext: AccessContext.WORKSPACE,
        idSource: 'params',
      });

      const context = createMockExecutionContext(user, {
        params: { workspaceId: 'noValidId' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('When workspace is not found, then throw ', async () => {
      const user = newUser();

      jest.spyOn(reflector, 'get').mockReturnValue({
        requiredRole: WorkspaceRole.MEMBER,
        accessContext: AccessContext.WORKSPACE,
        idSource: 'params',
      });

      workspaceUseCases.findUserAndWorkspace.mockResolvedValue({
        workspace: null,
        workspaceUser: null,
      });

      const context = createMockExecutionContext(user, {
        params: { workspaceId: v4() },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('When user is owner of the workspace and it is not setup yet, then grant access', async () => {
      const workspaceOwner = newUser();
      const workspace = newWorkspace({
        owner: workspaceOwner,
        attributes: { setupCompleted: false },
      });

      jest.spyOn(reflector, 'get').mockReturnValue({
        requiredRole: WorkspaceRole.OWNER,
        accessContext: AccessContext.WORKSPACE,
        idSource: 'params',
      });

      workspaceUseCases.findUserAndWorkspace.mockResolvedValue({
        workspace,
        workspaceUser: {} as WorkspaceUser,
      });

      const context = createMockExecutionContext(workspaceOwner, {
        params: { workspaceId: workspace.id },
      });

      await expect(guard.canActivate(context)).resolves.toBeTruthy();
    });

    it('When user is not owner of the workspace and it is not setup yet, then deny access', async () => {
      const workspaceOwner = newUser();
      const notOwner = newUser();

      const workspace = newWorkspace({
        owner: workspaceOwner,
        attributes: { setupCompleted: false },
      });

      jest.spyOn(reflector, 'get').mockReturnValue({
        requiredRole: WorkspaceRole.OWNER,
        accessContext: AccessContext.WORKSPACE,
        idSource: 'params',
      });

      workspaceUseCases.findUserAndWorkspace.mockResolvedValue({
        workspace,
        workspaceUser: {} as WorkspaceUser,
      });

      const context = createMockExecutionContext(notOwner, {
        params: { workspaceId: workspace.id },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('When user is owner of the workspace and required role is owner, then grant access', async () => {
      const workspaceOwner = newUser();
      const workspace = newWorkspace({ owner: workspaceOwner });

      jest.spyOn(reflector, 'get').mockReturnValue({
        requiredRole: WorkspaceRole.OWNER,
        accessContext: AccessContext.WORKSPACE,
        idSource: 'params',
      });

      workspaceUseCases.findUserAndWorkspace.mockResolvedValue({
        workspace,
        workspaceUser: {} as WorkspaceUser,
      });

      const context = createMockExecutionContext(workspaceOwner, {
        params: { workspaceId: workspace.id },
      });

      await expect(guard.canActivate(context)).resolves.toBeTruthy();
    });

    it('When user is not owner and required role is owner, then deny access', async () => {
      const nonOwnerUser = newUser();
      const workspace = newWorkspace();

      jest.spyOn(reflector, 'get').mockReturnValue({
        requiredRole: WorkspaceRole.OWNER,
        accessContext: AccessContext.WORKSPACE,
        idSource: 'params',
      });
      workspaceUseCases.findUserAndWorkspace.mockResolvedValue({
        workspace,
        workspaceUser: {} as WorkspaceUser,
      });
      const context = createMockExecutionContext(nonOwnerUser, {
        params: { workspaceId: workspace.id },
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('When user is member and required role is member, then grant access', async () => {
      const workspaceMember = newWorkspaceUser();
      const workspace = newWorkspace();

      jest.spyOn(reflector, 'get').mockReturnValue({
        requiredRole: WorkspaceRole.MEMBER,
        accessContext: AccessContext.WORKSPACE,
        idSource: 'params',
      });
      workspaceUseCases.findUserAndWorkspace.mockResolvedValue({
        workspace,
        workspaceUser: workspaceMember,
      });
      const context = createMockExecutionContext(workspaceMember, {
        params: { workspaceId: workspace.id },
      });
      const grantAccess = await guard.canActivate(context);

      expect(grantAccess).toBeTruthy();
    });

    it('When user is not member and required role is member, then deny access', async () => {
      const notMember = newUser();
      const workspace = newWorkspace();

      jest.spyOn(reflector, 'get').mockReturnValue({
        requiredRole: WorkspaceRole.MEMBER,
        accessContext: AccessContext.WORKSPACE,
        idSource: 'params',
      });
      workspaceUseCases.findUserAndWorkspace.mockResolvedValue({
        workspace,
        workspaceUser: null,
      });
      const context = createMockExecutionContext(notMember, {
        params: { workspaceId: workspace.id },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Team Permissions', () => {
    it('When Team id is invalid, then throw', async () => {
      const user = newUser();
      jest.spyOn(reflector, 'get').mockReturnValue({
        requiredRole: WorkspaceRole.MANAGER,
        accessContext: AccessContext.TEAM,
        idSource: 'params',
      });

      const context = createMockExecutionContext(user, {
        params: { teamId: 'invalidId' },
        query: {},
        body: {},
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('When Team does not exist, then throw', async () => {
      const user = newUser();
      const workspaceMember = newWorkspaceUser({ memberId: user.uuid });

      jest.spyOn(reflector, 'get').mockReturnValue({
        requiredRole: WorkspaceRole.MANAGER,
        accessContext: AccessContext.TEAM,
        idSource: 'params',
      });

      workspaceUseCases.findUserInTeam.mockResolvedValue({
        team: null,
        teamUser: null,
      });

      workspaceUseCases.findUserInWorkspace.mockResolvedValue(workspaceMember);

      const context = createMockExecutionContext(user, {
        params: { teamId: v4() },
        query: {},
        body: {},
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('When user is team member, then grant access', async () => {
      const user = newUser();
      const workspace = newWorkspace({ owner: user });
      const workspaceMember = newWorkspaceUser({
        memberId: user.uuid,
        workspaceId: workspace.id,
      });
      const team = newWorkspaceTeam({
        workspaceId: workspace.id,
        manager: user,
      });

      workspaceUseCases.findUserAndWorkspace.mockResolvedValue({
        workspace,
        workspaceUser: workspaceMember,
      });

      jest.spyOn(reflector, 'get').mockReturnValue({
        requiredRole: WorkspaceRole.MEMBER,
        accessContext: AccessContext.TEAM,
        idSource: 'params',
      });

      workspaceUseCases.findUserInTeam.mockResolvedValue({
        team,
        teamUser: {} as WorkspaceTeamUser,
      });

      const context = createMockExecutionContext(user, {
        params: { teamId: team.id },
      });

      await expect(guard.canActivate(context)).resolves.toBeTruthy();
    });

    it('When user is not manager and required role is manager, then deny access', async () => {
      const manager = newUser();
      const member = newUser();
      const team = newWorkspaceTeam({ manager });
      const workspace = newWorkspace();
      const workspaceMember = newWorkspaceUser({
        memberId: member.uuid,
        workspaceId: workspace.id,
      });

      jest.spyOn(reflector, 'get').mockReturnValue({
        requiredRole: WorkspaceRole.MANAGER,
        accessContext: AccessContext.TEAM,
        idSource: 'params',
      });

      workspaceUseCases.findUserAndWorkspace.mockResolvedValue({
        workspace,
        workspaceUser: workspaceMember,
      });

      workspaceUseCases.findUserInTeam.mockResolvedValue({
        team,
        teamUser: {} as WorkspaceTeamUser,
      });

      workspaceUseCases.findById.mockResolvedValue(workspace);

      const context = createMockExecutionContext(member, {
        params: { teamId: team.id },
      });
      const grantAccess = await guard.canActivate(context);

      expect(grantAccess).toBeFalsy();
    });

    it('When user is not part of team, then deny access', async () => {
      const nonMemberUser = newUser();
      const team = newWorkspaceTeam();
      const workspace = newWorkspace();
      const workspaceMember = newWorkspaceUser({
        memberId: nonMemberUser.uuid,
        workspaceId: workspace.id,
      });

      jest.spyOn(reflector, 'get').mockReturnValue({
        requiredRole: WorkspaceRole.MEMBER,
        accessContext: AccessContext.TEAM,
        idSource: 'params',
      });

      workspaceUseCases.findUserAndWorkspace.mockResolvedValue({
        workspace,
        workspaceUser: workspaceMember,
      });

      workspaceUseCases.findById.mockResolvedValue(workspace);
      workspaceUseCases.findUserInTeam.mockResolvedValue({
        team,
        teamUser: null,
      });

      const context = createMockExecutionContext(nonMemberUser, {
        params: { teamId: team.id },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('When user is deactivated, it should throw', async () => {
      const nonMemberUser = newUser();
      const team = newWorkspaceTeam();
      const workspace = newWorkspace();
      const workspaceMember = newWorkspaceUser({
        memberId: nonMemberUser.uuid,
        workspaceId: workspace.id,
        attributes: { deactivated: true },
      });

      jest.spyOn(reflector, 'get').mockReturnValue({
        requiredRole: WorkspaceRole.MEMBER,
        accessContext: AccessContext.TEAM,
        idSource: 'params',
      });

      workspaceUseCases.findUserAndWorkspace.mockResolvedValue({
        workspace,
        workspaceUser: workspaceMember,
      });
      const context = createMockExecutionContext(nonMemberUser, {
        params: { teamId: team.id },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('When team workspace does not exist, then throw', async () => {
      const nonMemberUser = newUser();
      const team = newWorkspaceTeam();
      const workspaceMember = newWorkspaceUser();

      jest.spyOn(reflector, 'get').mockReturnValue({
        requiredRole: WorkspaceRole.MEMBER,
        accessContext: AccessContext.TEAM,
        idSource: 'params',
      });

      workspaceUseCases.findUserAndWorkspace.mockResolvedValue({
        workspace: null,
        workspaceUser: workspaceMember,
      });

      workspaceUseCases.findById.mockResolvedValue(null);
      workspaceUseCases.findUserInTeam.mockResolvedValue({
        team,
        teamUser: null,
      });

      const context = createMockExecutionContext(nonMemberUser, {
        params: { teamId: team.id },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

const createMockExecutionContext = (
  user: any,
  requestPayload: any,
): ExecutionContext =>
  ({
    getHandler: () => ({
      name: 'endPointHandler',
    }),
    switchToHttp: () => ({
      getRequest: () => ({
        user: user,
        ...requestPayload,
      }),
    }),
  }) as unknown as ExecutionContext;
