import { DeepMocked, createMock } from '@golevelup/ts-jest';
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

      workspacesUsecases.getAvailableWorkspaces.mockResolvedValueOnce([
        { workspace, workspaceUser },
      ]);
      await expect(
        workspacesController.getAvailableWorkspaces(user),
      ).resolves.toEqual([{ workspace, workspaceUser }]);
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

  describe('DELETE /:workspaceId/members/leave', () => {
    const user = newUser();
    it('When owner leaves workspace, then wipeout should occur', async () => {
      const workspace = newWorkspace({ owner: user });

      jest.spyOn(workspacesUsecases, 'deleteWorkspaceContent');
      jest
        .spyOn(workspacesUsecases, 'findById')
        .mockResolvedValueOnce(workspace);
      await workspacesController.leaveWorkspace(user, workspace.id);

      expect(workspacesUsecases.deleteWorkspaceContent).toHaveBeenCalledWith(
        workspace.id,
        user,
      );
    });
    describe('When member attempts to leave workspace', () => {
      it('When member does not have any items, then leave workspace', async () => {});
      it('When member has items, then return error', async () => {});
    });
    it('When team owner leaves workspace, then transfer ownership to workspace owner and leave workspace', async () => {});
  });
});
