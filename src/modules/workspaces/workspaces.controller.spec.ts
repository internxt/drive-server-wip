import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { BadRequestException } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesUsecases } from './workspaces.usecase';
import { WorkspaceRole } from './guards/workspace-required-access.decorator';

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
});
