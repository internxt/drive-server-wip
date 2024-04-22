import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { SequelizeWorkspaceRepository } from './workspaces.repository';
import { WorkspaceModel } from '../models/workspace.model';
import { WorkspaceUserModel } from '../models/workspace-users.model';
import { WorkspaceInviteModel } from '../models/workspace-invite.model';
import { createMock } from '@golevelup/ts-jest';
import { WorkspaceInvite } from '../domains/workspace-invite.domain';
import { WorkspaceUser } from '../domains/workspace-user.domain';
import {
  newWorkspaceInvite,
  newWorkspaceUser,
} from '../../../../test/fixtures';
import { Workspace } from '../domains/workspaces.domain';
import { v4 } from 'uuid';

describe('SequelizeWorkspaceRepository', () => {
  let repository: SequelizeWorkspaceRepository;
  let workspaceModel: typeof WorkspaceModel;
  let workspaceUserModel: typeof WorkspaceUserModel;
  let workspaceInviteModel: typeof WorkspaceInviteModel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizeWorkspaceRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get<SequelizeWorkspaceRepository>(
      SequelizeWorkspaceRepository,
    );
    workspaceModel = module.get<typeof WorkspaceModel>(
      getModelToken(WorkspaceModel),
    );
    workspaceUserModel = module.get<typeof WorkspaceUserModel>(
      getModelToken(WorkspaceUserModel),
    );
    workspaceInviteModel = module.get<typeof WorkspaceInviteModel>(
      getModelToken(WorkspaceInviteModel),
    );
  });

  describe('findInvite', () => {
    it('When a workspace invitation is searched and it is found, it should return the respective invitation', async () => {
      const mockInvite = newWorkspaceInvite();

      jest
        .spyOn(workspaceInviteModel, 'findOne')
        .mockResolvedValueOnce(mockInvite as WorkspaceInviteModel);

      const result = await repository.findInvite({ id: '1' });
      expect(result).toBeInstanceOf(WorkspaceInvite);
      expect(result.id).toEqual(mockInvite.id);
    });

    it('When a workspace invitation is searched and it is not found, it should return null', async () => {
      jest.spyOn(workspaceInviteModel, 'findOne').mockResolvedValueOnce(null);

      const result = await repository.findInvite({ id: '1' });
      expect(result).toBeNull();
    });
  });

  describe('getWorkspaceInvitationsCount', () => {
    it('When a workspace invitations number is searched, then it should return the respective number', async () => {
      jest.spyOn(workspaceInviteModel, 'count').mockResolvedValueOnce(5);
      const count = await repository.getWorkspaceInvitationsCount('1');
      expect(count).toEqual(5);
    });
  });

  describe('bulkUpdateInvitesKeysAndUsers', () => {
    it('When invites are being updated, then it should update each invite with the correct invitedUser and encryptionKey', async () => {
      const invites = [newWorkspaceInvite(), newWorkspaceInvite()];

      await repository.bulkUpdateInvitesKeysAndUsers(invites);

      expect(workspaceInviteModel.update).toHaveBeenNthCalledWith(
        1,
        {
          invitedUser: invites[0].invitedUser,
          encryptionKey: invites[0].encryptionKey,
        },
        { where: { id: invites[0].id } },
      );

      expect(workspaceInviteModel.update).toHaveBeenNthCalledWith(
        2,
        {
          invitedUser: invites[1].invitedUser,
          encryptionKey: invites[1].encryptionKey,
        },
        { where: { id: invites[1].id } },
      );
    });
  });

  describe('findWorkspaceUser', () => {
    it('When a workspace user is searched and found, it should return the respective user', async () => {
      const workspaceUser = newWorkspaceUser();
      const mockWorkspaceUser = {
        memberId: workspaceUser.id,
        workspaceId: workspaceUser.workspaceId,
        ...workspaceUser.toJSON(),
      };

      jest.spyOn(workspaceUserModel, 'findOne').mockResolvedValueOnce({
        ...mockWorkspaceUser,
        toJSON: jest.fn().mockReturnValue(mockWorkspaceUser),
      } as any);

      const result = await repository.findWorkspaceUser({ memberId: '1' });
      expect(result).toBeInstanceOf(WorkspaceUser);
      expect(result).toEqual(
        expect.objectContaining({
          ...workspaceUser.toJSON(),
        }),
      );
    });

    it('When a workspace user is searched and not found, it should return nothing', async () => {
      jest.spyOn(workspaceUserModel, 'findOne').mockResolvedValueOnce(null);
      const result = await repository.findWorkspaceUser({ memberId: '1' });
      expect(result).toBeNull();
    });
  });

  describe('getSpaceLimitInInvitations', () => {
    it('When the result is null, it should return 0', async () => {
      jest.spyOn(workspaceInviteModel, 'sum').mockResolvedValueOnce(null);

      const totalSpace = await repository.getSpaceLimitInInvitations('1');
      expect(totalSpace).toStrictEqual(BigInt(0));
    });
  });

  describe('getTotalSpaceLimitInWorkspaceUsers', () => {
    it('When the total is calculated, the respective space should be returned', async () => {
      jest.spyOn(workspaceUserModel, 'sum').mockResolvedValueOnce(10);

      const total = await repository.getTotalSpaceLimitInWorkspaceUsers('1');
      expect(total).toStrictEqual(BigInt(10));
    });
  });

  describe('findWorkspaceAndUser', () => {
    it('When workspace and user in workspace are found, it should return both', async () => {
      const userUuid = 'user-uuid';
      const workspaceId = 'workspace-id';
      const mockWorkspaceUser = newWorkspaceUser({
        attributes: { memberId: userUuid, workspaceId },
      });
      const mockWorkspace = {
        id: workspaceId,
        toJSON: jest.fn().mockReturnValue({
          id: workspaceId,
        }),
        workspaceUsers: [mockWorkspaceUser],
      };

      jest
        .spyOn(workspaceModel, 'findOne')
        .mockResolvedValueOnce(mockWorkspace as any);

      const result = await repository.findWorkspaceAndUser(
        userUuid,
        workspaceId,
      );

      expect(result).toEqual({
        workspace: expect.any(Workspace),
        workspaceUser: expect.any(WorkspaceUser),
      });

      expect(result.workspace.id).toEqual(workspaceId);
      expect(result.workspaceUser.id).toEqual(mockWorkspaceUser.id);
    });

    it('When workspace is not found, it should return null for both values', async () => {
      jest.spyOn(workspaceModel, 'findOne').mockResolvedValueOnce(null);

      const result = await repository.findWorkspaceAndUser(
        'user-uuid',
        'workspace-id',
      );

      expect(result).toEqual({
        workspace: null,
        workspaceUser: null,
      });
    });

    it('When workspace is found but no user is found, it should return null user', async () => {
      const workspaceId = 'workspace-id';
      const mockWorkspace = {
        id: workspaceId,
        toJSON: jest.fn().mockReturnValue({
          id: workspaceId,
        }),
        workspaceUsers: [],
      };

      jest
        .spyOn(workspaceModel, 'findOne')
        .mockResolvedValueOnce(mockWorkspace as any);

      const result = await repository.findWorkspaceAndUser(
        'user-uuid',
        'workspace-id',
      );

      expect(result).toEqual({
        workspace: expect.any(Workspace),
        workspaceUser: null,
      });
    });
  });
});
