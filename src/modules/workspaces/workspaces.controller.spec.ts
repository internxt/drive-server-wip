import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { BadRequestException } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesUsecases } from './workspaces.usecase';
import { WorkspaceRole } from './guards/workspace-required-access.decorator';
import {
  newUser,
  newWorkspace,
  newWorkspaceInvite,
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
    it('When memberId is not a valid uuid, then it throws.', async () => {
      workspacesUsecases.changeUserRole.mockRejectedValueOnce(
        new BadRequestException(),
      );
      await expect(
        workspacesController.changeMemberRole('', '', 'notValidUuid', {
          role: WorkspaceRole.MEMBER,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('When input is valid, then it works', async () => {
      await expect(
        workspacesController.changeMemberRole(
          '',
          '',
          '9aa9399e-8697-41f7-88e3-df1d78794cb8',
          {
            role: WorkspaceRole.MEMBER,
          },
        ),
      ).resolves.toBeTruthy();
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

    it('When workspace id is not a valid uuid, then it throws.', async () => {
      workspacesUsecases.changeUserRole.mockRejectedValueOnce(
        new BadRequestException(),
      );
      await expect(
        workspacesController.setupWorkspace(
          user,
          'notValidUuid',
          workspaceDatDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When input is valid, then it works', async () => {
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
    it('When workspace id is not a valid uuid, then it throws.', async () => {
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
});