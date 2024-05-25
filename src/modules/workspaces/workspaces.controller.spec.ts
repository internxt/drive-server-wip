import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { BadRequestException } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesUsecases } from './workspaces.usecase';
import { WorkspaceRole } from './guards/workspace-required-access.decorator';
import {
  newUser,
  newWorkspace,
  newWorkspaceInvite,
  newWorkspaceTeamUser,
  newWorkspaceUser,
} from '../../../test/fixtures';
import { v4 } from 'uuid';

describe('Workspace Controller', () => {
  let workspacesController: WorkspacesController;
  let workspacesUsecases: DeepMocked<WorkspacesUsecases>;

  beforeEach(async () => {
    workspacesUsecases = createMock<WorkspacesUsecases>();

    workspacesController = new WorkspacesController(workspacesUsecases);
  });

  it('should be defined', () => {
    expect(workspacesController).toBeDefined();
  });

  describe('PATCH /:workspaceId/teams/:teamId/members/:memberId/role', () => {
    it('When role is updated correctly, then it works', async () => {
      const userUuid = '9aa9399e-8697-41f7-88e3-df1d78794cb8';
      const teamId = '286d2eea-8319-4a3f-a66b-d2b80e5c08fe';
      const workspaceId = '3864950c-122d-4df3-b126-4d8b3fc23c29';

      await expect(
        workspacesController.changeMemberRole(workspaceId, teamId, userUuid, {
          role: WorkspaceRole.MEMBER,
        }),
      ).resolves.toBeTruthy();

      expect(workspacesUsecases.changeUserRole).toHaveBeenCalledWith(
        workspaceId,
        teamId,
        userUuid,
        {
          role: WorkspaceRole.MEMBER,
        },
      );
    });
  });

  describe('PATCH /:workspaceId/setup', () => {
    const user = newUser();
    const workspaceDatDto = {
      name: 'Test Workspace',
      description: 'Workspace description',
      address: 'Workspace Address',
      encryptedMnemonic: 'encryptedMnemonic',
    };

    it('Workspace is set up correctly, then it works', async () => {
      await expect(
        workspacesController.setupWorkspace(user, v4(), workspaceDatDto),
      ).resolves.toBeTruthy();
    });
  });

  describe('GET /', () => {
    it('When available workspaces are requested, then it should return workspaces and user data', async () => {
      const user = newUser();
      const workspace = newWorkspace({
        attributes: { setupCompleted: true },
      });
      const workspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user.uuid,
        attributes: { deactivated: false },
      });

      workspacesUsecases.getAvailableWorkspaces.mockResolvedValueOnce({
        availableWorkspaces: [{ workspace, workspaceUser }],
        pendingWorkspaces: [],
      });
      await expect(
        workspacesController.getAvailableWorkspaces(user),
      ).resolves.toEqual({
        availableWorkspaces: [{ workspace, workspaceUser }],
        pendingWorkspaces: [],
      });
    });
  });

  describe('PATCH /teams/:teamId', () => {
    it('When teamId is valid and update is successful, then resolve', async () => {
      await expect(
        workspacesController.editTeam(v4(), { name: 'new name' }),
      ).resolves.toBeTruthy();
    });
  });

  describe('POST /teams/:teamId/user/:userUuid', () => {
    it('When member is added succesfully, return member data', async () => {
      const teamUser = newWorkspaceTeamUser();

      workspacesUsecases.addMemberToTeam.mockResolvedValueOnce(teamUser);

      const newTeamMember = await workspacesController.addUserToTeam(
        v4(),
        v4(),
      );

      expect(newTeamMember).toEqual(teamUser);
    });
  });

  describe('DELETE /teams/:teamId/user/:userUuid', () => {
    it('When member is removed succesfully, then return', async () => {
      await expect(
        workspacesController.removeUserFromTeam(v4(), v4()),
      ).resolves.toBeTruthy();
    });
  });

  describe('GET /pending-setup', () => {
    it('When workspaces ready to be setup are requested, then it should return workspaces data', async () => {
      const owner = newUser();
      const workspace = newWorkspace({
        owner,
        attributes: { setupCompleted: false },
      });

      workspacesUsecases.getWorkspacesPendingToBeSetup.mockResolvedValueOnce([
        workspace,
      ]);
      await expect(
        workspacesController.getUserWorkspacesToBeSetup(owner),
      ).resolves.toEqual([workspace]);
    });
  });

  describe('POST /invitations/accept', () => {
    const user = newUser();
    it('When invitation is accepted successfully, then it returns.', async () => {
      const invite = newWorkspaceInvite({ invitedUser: user.uuid });

      await workspacesController.acceptWorkspaceInvitation(user, {
        inviteId: invite.id,
      });

      expect(workspacesUsecases.acceptWorkspaceInvite).toHaveBeenCalledWith(
        user,
        invite.id,
      );
    });
  });

  describe('PATCH /:workspaceId', () => {
    it('When workspace details are updated successfully, then it should return.', async () => {
      const user = newUser();
      const workspace = newWorkspace({ owner: user });

      workspacesController.editWorkspaceDetails(workspace.id, user, {
        name: 'new name',
      });

      jest
        .spyOn(workspacesUsecases, 'editWorkspaceDetails')
        .mockResolvedValue(Promise.resolve());

      await expect(
        workspacesController.editWorkspaceDetails(workspace.id, user, {
          name: 'new name',
          description: 'new description',
        }),
      ).resolves.toBeUndefined();

      expect(workspacesUsecases.editWorkspaceDetails).toHaveBeenCalledWith(
        workspace.id,
        user,
        { name: 'new name' },
      );
    });
  });
  describe('GET /:workspaceId/members', () => {
    const owner = newUser();
    const workspace = newWorkspace({
      owner,
      attributes: { setupCompleted: true },
    });

    it('When the workspaceId is missing then it should throw BadRequestException', async () => {
      const expectResponse = expect(async () => {
        await workspacesController.getWorkspaceMembers(null, owner);
      });
      expectResponse.rejects.toThrow(BadRequestException);
      expectResponse.rejects.toThrow('Invalid workspace ID');
    });

    it('When the user is null or empty then it should return null', async () => {
      const user = null;
      workspacesUsecases.getWorkspaceMembers.mockResolvedValue(null);

      const response = await workspacesController.getWorkspaceMembers(
        workspace.id,
        user,
      );
      expect(response).toBeNull();
    });

    it('When members are requested with "workspaceId" and "user", then it should return workspaces members data', async () => {
      const user1 = newUser();
      const user2 = newUser();

      const ownerWorkspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: owner.uuid,
        member: owner,
        attributes: { deactivated: false },
      });
      const userWorkspace1 = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user1.uuid,
        member: user1,
        attributes: { deactivated: false },
      });
      const userWorkspace2 = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user2.uuid,
        member: user2,
        attributes: { deactivated: true },
      });

      const mockResolvedValues = {
        activatedUsers: [
          {
            ...ownerWorkspaceUser.toJSON(),
            isOwner: true,
            isManager: true,
            freeSpace: ownerWorkspaceUser.getFreeSpace(),
            usedSpace: ownerWorkspaceUser.getUsedSpace(),
          },
          {
            ...userWorkspace1.toJSON(),
            isOwner: false,
            isManager: false,
            freeSpace: userWorkspace1.getFreeSpace(),
            usedSpace: userWorkspace1.getUsedSpace(),
          },
        ],
        disabledUsers: [
          {
            ...userWorkspace2.toJSON(),
            isOwner: false,
            isManager: false,
            freeSpace: userWorkspace2.getFreeSpace(),
            usedSpace: userWorkspace2.getUsedSpace(),
          },
        ],
      };
      workspacesUsecases.getWorkspaceMembers.mockResolvedValueOnce(
        mockResolvedValues,
      );

      const getMembers = await workspacesController.getWorkspaceMembers(
        workspace.id,
        owner,
      );
      expect(getMembers).toEqual(mockResolvedValues);
    });
  });
});
