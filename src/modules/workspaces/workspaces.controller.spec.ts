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

  describe('PATCH /:workspaceId/teams/:teamId/members/role', () => {
    it('When there is an error while updating user role, then the error is returned', async () => {
      workspacesUsecases.changeUserRole.mockRejectedValueOnce(
        new BadRequestException(),
      );
      await expect(
        workspacesController.changeMemberRole('', '', {
          userId: '',
          role: WorkspaceRole.MEMBER,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
