import { Test, type TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { SequelizeWorkspaceRepository } from './workspaces.repository';
import { WorkspaceModel } from '../models/workspace.model';
import { WorkspaceUserModel } from '../models/workspace-users.model';
import { WorkspaceInviteModel } from '../models/workspace-invite.model';
import { createMock } from '@golevelup/ts-jest';
import { WorkspaceInvite } from '../domains/workspace-invite.domain';
import { WorkspaceUser } from '../domains/workspace-user.domain';
import {
  newUser,
  newWorkspace,
  newWorkspaceInvite,
  newWorkspaceUser,
} from '../../../../test/fixtures';
import { Workspace } from '../domains/workspaces.domain';
import { User } from '../../user/user.domain';
import { Op } from 'sequelize';
import { WorkspaceLogModel } from '../models/workspace-logs.model';
import {
  WorkspaceLogPlatform,
  WorkspaceLogType,
} from '../attributes/workspace-logs.attributes';
import { v4 } from 'uuid';
import { type WorkspaceLog } from '../domains/workspace-log.domain';
import { WorkspaceItemType } from '../attributes/workspace-items-users.attributes';
import { WorkspaceItemUserModel } from '../models/workspace-items-users.model';
import { WorkspaceItemUser } from '../domains/workspace-item-user.domain';
import { FileModel } from '../../file/file.model';
import { FolderModel } from '../../folder/folder.model';
import { FileStatus } from '../../file/file.domain';
import { UserModel } from '../../user/user.model';

describe('SequelizeWorkspaceRepository', () => {
  let repository: SequelizeWorkspaceRepository;
  let workspaceModel: typeof WorkspaceModel;
  let workspaceUserModel: typeof WorkspaceUserModel;
  let workspaceInviteModel: typeof WorkspaceInviteModel;
  let workspaceLogModel: typeof WorkspaceLogModel;
  let workspaceItemUserModel: typeof WorkspaceItemUserModel;

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
    workspaceLogModel = module.get<typeof WorkspaceLogModel>(
      getModelToken(WorkspaceLogModel),
    );
    workspaceItemUserModel = module.get<typeof WorkspaceItemUserModel>(
      getModelToken(WorkspaceItemUserModel),
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
      expect(result.toJSON()).toMatchObject({
        ...workspaceUser.toJSON(),
      });
    });

    it('When a workspace user is searched and not found, it should return nothing', async () => {
      jest.spyOn(workspaceUserModel, 'findOne').mockResolvedValueOnce(null);
      const result = await repository.findWorkspaceUser({ memberId: '1' });
      expect(result).toBeNull();
    });

    it('When a workspace user is searched with a user include, then it should return the user', async () => {
      const user = newUser();
      const mockWorworkspaceUserkspaceUser = newWorkspaceUser({
        memberId: user.uuid,
        member: user,
      });

      jest
        .spyOn(workspaceUserModel, 'findOne')
        .mockResolvedValueOnce(mockWorworkspaceUserkspaceUser as any);

      const result = await repository.findWorkspaceUser(
        { memberId: '1' },
        true,
      );
      expect(result).toBeInstanceOf(WorkspaceUser);
      expect(result.member).toBeInstanceOf(User);
    });
  });

  describe('getSpaceLimitInInvitations', () => {
    it('When the result is null, it should return 0', async () => {
      jest.spyOn(workspaceInviteModel, 'sum').mockResolvedValueOnce(null);

      const totalSpace = await repository.getSpaceLimitInInvitations('1');
      expect(totalSpace).toStrictEqual(0);
    });
  });

  describe('getTotalSpaceLimitInWorkspaceUsers', () => {
    it('When the total is calculated, the respective space should be returned', async () => {
      jest.spyOn(workspaceUserModel, 'sum').mockResolvedValueOnce(10);

      const total = await repository.getTotalSpaceLimitInWorkspaceUsers('1');
      expect(total).toStrictEqual(10);
    });
  });

  describe('deactivateWorkspaceUser', () => {
    it('When the user is deactivated, then the respective user should be deleted', async () => {
      const member = newUser();
      const workspace = newWorkspace();

      await repository.deactivateWorkspaceUser(member.uuid, workspace.id);
      expect(workspaceUserModel.update).toHaveBeenCalledWith(
        { deactivated: true },
        { where: { memberId: member.uuid, workspaceId: workspace.id } },
      );
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

    describe('deleteById', () => {
      it('When a workspace is deleted, it should call the model to delete the workspace', async () => {
        await repository.deleteById('1');
        expect(workspaceModel.destroy).toHaveBeenCalledWith({
          where: { id: '1' },
        });
      });
    });
  });

  describe('findWorkspaceUsers', () => {
    it('When passing workspace id and not a search value, it should return all the users that belongs to that workspace', async () => {
      const workspace = newWorkspace();
      const user1 = newUser();
      const user2 = newUser();
      const workspaceUser1 = newWorkspaceUser({
        workspaceId: workspace.id,
        member: user1,
        memberId: user1.uuid,
      });
      const workspaceUser2 = newWorkspaceUser({
        workspaceId: workspace.id,
        member: user2,
        memberId: user2.uuid,
      });
      const mockWorkspaceUserModel = [
        {
          ...workspaceUser1,
          toJSON: jest.fn().mockReturnValue(workspaceUser1),
        },
        {
          ...workspaceUser2,
          toJSON: jest.fn().mockReturnValue(workspaceUser2),
        },
      ] as unknown as WorkspaceUserModel[];

      const spyWUM = jest
        .spyOn(workspaceUserModel, 'findAll')
        .mockResolvedValueOnce(mockWorkspaceUserModel);

      const result = await repository.findWorkspaceUsers(workspace.id);

      expect(spyWUM).toHaveBeenCalledWith({
        where: {
          workspaceId: workspace.id,
        },
        include: expect.anything(),
      });
      expect(result[0].member).toBeInstanceOf(User);
      expect(result).toEqual([
        expect.objectContaining(workspaceUser1),
        expect.objectContaining(workspaceUser2),
      ]);
    });

    it('When passing the workspace id and a search value, it should return all users that match the search on username, email, or last name.', async () => {
      const workspaceId = '2b27db5b-5162-42df-a8f4-8b5639b50451';
      const searchValue = 'imposible-to-get-this-one';
      const spyWUM = jest
        .spyOn(workspaceUserModel, 'findAll')
        .mockResolvedValueOnce([]);

      const response = await repository.findWorkspaceUsers(
        workspaceId,
        searchValue,
      );

      expect(response).toBeTruthy;
      expect(spyWUM).toHaveBeenCalledWith({
        where: expect.objectContaining({
          workspaceId: workspaceId,
          [Op.or]: expect.arrayContaining([
            expect.objectContaining({
              '$member.lastname$': {
                [Op.substring]: searchValue,
              },
            }),
          ]),
        }),
        include: expect.arrayContaining([
          expect.objectContaining({
            as: 'member',
          }),
        ]),
      });
      expect(response).toEqual([]);
    });
  });

  describe('findWorkspaceAndDefaultUser', () => {
    it('When workspace and default user are found, it should return successfully', async () => {
      const mockWorkspace = newWorkspace();
      const mockUser = newUser();
      const mockWorkspaceWithUser = {
        id: mockWorkspace.id,
        workpaceUser: {
          ...mockUser,
          get: jest.fn().mockReturnValue(mockUser),
        },
        toJSON: jest.fn().mockReturnValue({
          id: mockWorkspace.id,
        }),
      };

      jest
        .spyOn(workspaceModel, 'findOne')
        .mockResolvedValueOnce(mockWorkspaceWithUser as any);

      const result = await repository.findWorkspaceAndDefaultUser(
        mockWorkspace.id,
      );

      expect(result).toEqual({
        workspaceUser: expect.any(User),
        workspace: expect.any(Workspace),
      });
      expect(result.workspace.id).toEqual(mockWorkspace.id);
      expect(result.workspaceUser.uuid).toEqual(mockUser.uuid);
    });

    it('When workspace is not found, it should return null', async () => {
      jest.spyOn(workspaceModel, 'findOne').mockResolvedValueOnce(null);

      const result =
        await repository.findWorkspaceAndDefaultUser('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('accessLogs', () => {
    const workspaceId = v4();
    const user = newUser({ attributes: { email: 'test@example.com' } });
    const pagination = { limit: 10, offset: 0 };
    const mockMembersUuids: string[] = undefined;
    const logType: WorkspaceLog['type'][] = [
      WorkspaceLogType.Login,
      WorkspaceLogType.Logout,
    ];
    const lastDays = 7;
    const order: [string, string][] = [['updatedAt', 'DESC']];
    const date = new Date();

    const workspaceLogtoJson = {
      id: v4(),
      workspaceId,
      creator: user.uuid,
      type: WorkspaceLogType.Login,
      platform: WorkspaceLogPlatform.Web,
      entityId: null,
      createdAt: date,
      updatedAt: date,
    };
    const mockLogs: WorkspaceLog[] = [
      {
        ...workspaceLogtoJson,
        user: {
          id: 4,
          name: user.name,
          lastname: user.lastname,
          email: user.email,
          uuid: user.uuid,
        },
        workspace: {
          id: workspaceId,
          name: 'My Workspace',
        },
        file: null,
        folder: null,
        toJSON: () => ({ ...workspaceLogtoJson }),
      },
    ];

    it('when lastDays is provided, then should filter logs by date', async () => {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - lastDays);
      dateLimit.setMilliseconds(0);

      const whereConditions = {
        workspaceId,
        updatedAt: { [Op.gte]: dateLimit },
      };

      jest
        .spyOn(workspaceLogModel, 'findAll')
        .mockResolvedValue(mockLogs as WorkspaceLogModel[]);

      await repository.accessLogs(
        workspaceId,
        true,
        mockMembersUuids,
        logType,
        pagination,
        lastDays,
        order,
      );

      expect(workspaceLogModel.findAll).toHaveBeenCalledWith({
        where: expect.objectContaining(whereConditions),
        include: expect.any(Array),
        ...pagination,
        order,
      });
    });

    it('when member is provided, then should filter logs by member email or name', async () => {
      const mockMembers = [newWorkspaceUser(), newWorkspaceUser()];
      const mockMembersUuids = mockMembers.map((m) => m.memberId);
      const whereConditions = {
        workspaceId,
        creator: { [Op.in]: mockMembersUuids },
      };

      jest
        .spyOn(workspaceLogModel, 'findAll')
        .mockResolvedValue(mockLogs as WorkspaceLogModel[]);

      await repository.accessLogs(
        workspaceId,
        true,
        mockMembersUuids,
        logType,
        pagination,
        lastDays,
        order,
      );

      expect(workspaceLogModel.findAll).toHaveBeenCalledWith({
        where: expect.objectContaining(whereConditions),
        include: expect.any(Array),
        ...pagination,
        order,
      });
    });

    it('when logType is provided, then should filter logs by type', async () => {
      const whereConditions = {
        workspaceId,
        type: { [Op.in]: logType },
      };

      jest
        .spyOn(workspaceLogModel, 'findAll')
        .mockResolvedValue(mockLogs as WorkspaceLogModel[]);

      await repository.accessLogs(
        workspaceId,
        true,
        mockMembersUuids,
        logType,
        pagination,
        lastDays,
        order,
      );

      expect(workspaceLogModel.findAll).toHaveBeenCalledWith({
        where: expect.objectContaining(whereConditions),
        include: expect.any(Array),
        ...pagination,
        order,
      });
    });

    it('when summary is true, then should return summary of logs', async () => {
      jest
        .spyOn(workspaceLogModel, 'findAll')
        .mockResolvedValue(mockLogs as WorkspaceLogModel[]);
      jest
        .spyOn(repository, 'workspaceLogToDomainSummary')
        .mockImplementation((log) => log as WorkspaceLog);

      await repository.accessLogs(
        workspaceId,
        true,
        mockMembersUuids,
        logType,
        pagination,
        lastDays,
        order,
      );

      expect(repository.workspaceLogToDomainSummary).toHaveBeenCalledWith(
        mockLogs[0],
      );
    });

    it('when pagination is not provided, then should use default pagination', async () => {
      const whereConditions = {
        workspaceId,
      };

      jest
        .spyOn(workspaceLogModel, 'findAll')
        .mockResolvedValue(mockLogs as WorkspaceLogModel[]);

      await repository.accessLogs(
        workspaceId,
        true,
        mockMembersUuids,
        logType,
        undefined,
        lastDays,
        order,
      );

      expect(workspaceLogModel.findAll).toHaveBeenCalledWith({
        where: expect.objectContaining(whereConditions),
        include: expect.any(Array),
        order,
      });
    });

    it('when order is not provided, then should use default order', async () => {
      const whereConditions = {
        workspaceId,
      };

      jest
        .spyOn(workspaceLogModel, 'findAll')
        .mockResolvedValue(mockLogs as WorkspaceLogModel[]);

      await repository.accessLogs(
        workspaceId,
        true,
        mockMembersUuids,
        logType,
        pagination,
        lastDays,
      );

      expect(workspaceLogModel.findAll).toHaveBeenCalledWith({
        where: expect.objectContaining(whereConditions),
        include: expect.any(Array),
        ...pagination,
        order: [['updatedAt', 'DESC']],
      });
    });
  });

  describe('workspaceLogToDomain()', () => {
    const workspaceId = v4();
    const fileId = v4();
    it('When model is provided, then it should return a WorkspaceLog entity', async () => {
      const toJson = {
        id: v4(),
        workspaceId: workspaceId,
        type: WorkspaceLogType.ShareFile,
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: v4(),
        entityId: fileId,
        platform: 'WEB',
      };
      const model: WorkspaceLogModel = {
        user: { id: 10, name: 'John Doe' },
        workspace: { id: workspaceId, name: 'My Workspace' },
        file: { uuid: fileId, plainName: 'example.txt' },
        folder: null,
        toJSON: () => ({ ...toJson }),
      } as any;

      const result = repository.workspaceLogToDomain(model);

      expect(result).toEqual(
        expect.objectContaining({
          ...toJson,
        }),
      );
    });
  });

  describe('workspaceLogToDomainSummary()', () => {
    const workspaceId = v4();
    const folderId = v4();
    it('When model is provided, then it should return a summary of WorkspaceLog entity', async () => {
      const toJson = {
        id: v4(),
        type: WorkspaceLogType.ShareFolder,
        workspaceId: workspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: v4(),
        entityId: folderId,
        platform: WorkspaceLogPlatform.Web,
      };
      const model: WorkspaceLogModel = {
        user: { id: 20, name: 'John Doe' },
        workspace: { id: workspaceId, name: 'My Workspace' },
        file: null,
        folder: { uuid: folderId, plainName: 'My Folder' },
        toJSON: () => ({ ...toJson }),
      } as any;

      const result = repository.workspaceLogToDomainSummary(model);

      expect(result).toEqual(
        expect.objectContaining({
          ...toJson,
          file: null,
          folder: model.folder,
          user: model.user,
          workspace: model.workspace,
        }),
      );
    });
  });

  describe('findWorkspaceUsersByUserUuid', () => {
    it('When workspace users are found by user UUID, then return them correctly', async () => {
      const userUuid = v4();
      const mockWorkspaceUsers = [newWorkspaceUser(), newWorkspaceUser()];

      jest
        .spyOn(workspaceUserModel, 'findAll')
        .mockResolvedValueOnce(mockWorkspaceUsers as any);

      const result = await repository.findWorkspaceUsersByUserUuid(userUuid);

      expect(workspaceUserModel.findAll).toHaveBeenCalledWith({
        where: { memberId: userUuid },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(WorkspaceUser);
    });
  });

  describe('findByOwner', () => {
    it('When workspaces are searched by owner ID, then return all owned workspaces', async () => {
      const ownerId = v4();
      const mockWorkspaces = [newWorkspace(), newWorkspace()];

      jest
        .spyOn(workspaceModel, 'findAll')
        .mockResolvedValueOnce(mockWorkspaces as any);

      const result = await repository.findByOwner(ownerId);

      expect(workspaceModel.findAll).toHaveBeenCalledWith({
        where: { ownerId },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Workspace);
    });
  });

  describe('findWorkspaceUsersOfOwnedWorkspaces', () => {
    it('When searching for workspace users of owned workspaces, then return workspace and user pairs', async () => {
      const ownerId = v4();
      const mockWorkspaceUser = newWorkspaceUser();
      const mockWorkspace = newWorkspace();
      const mockData = [
        {
          ...mockWorkspaceUser,
          workspace: mockWorkspace,
          toJSON: jest.fn().mockReturnValue(mockWorkspaceUser),
        },
      ];

      jest
        .spyOn(workspaceUserModel, 'findAll')
        .mockResolvedValueOnce(mockData as any);

      const result =
        await repository.findWorkspaceUsersOfOwnedWorkspaces(ownerId);

      expect(workspaceUserModel.findAll).toHaveBeenCalledWith({
        where: { memberId: ownerId },
        include: {
          model: WorkspaceModel,
          as: 'workspace',
          where: { ownerId },
          required: true,
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0].workspace).toBeInstanceOf(Workspace);
      expect(result[0].workspaceUser).toBeInstanceOf(WorkspaceUser);
    });
  });

  describe('findOne', () => {
    it('When workspace is found with where clause, then return the workspace', async () => {
      const mockWorkspace = newWorkspace();

      jest
        .spyOn(workspaceModel, 'findOne')
        .mockResolvedValueOnce(mockWorkspace as any);

      const result = await repository.findOne({ name: 'test-workspace' });

      expect(workspaceModel.findOne).toHaveBeenCalledWith({
        where: { name: 'test-workspace' },
      });
      expect(result).toBeInstanceOf(Workspace);
    });

    it('When workspace is not found, then return null', async () => {
      jest.spyOn(workspaceModel, 'findOne').mockResolvedValueOnce(null);

      const result = await repository.findOne({ name: 'non-existent' });

      expect(result).toBeNull();
    });
  });

  describe('createItem', () => {
    it('When creating a workspace item, then return the created item', async () => {
      const itemData = {
        itemId: v4(),
        itemType: WorkspaceItemType.File,
        createdBy: v4(),
        workspaceId: v4(),
        createdAt: new Date(),
        updatedAt: new Date(),
        context: 'workspace' as any,
      };
      const mockCreatedItem = {
        ...itemData,
        id: v4(),
        toJSON: jest.fn().mockReturnValue(itemData),
      };

      jest
        .spyOn(workspaceItemUserModel, 'create')
        .mockResolvedValueOnce(mockCreatedItem as any);

      const result = await repository.createItem(itemData as any);

      expect(workspaceItemUserModel.create).toHaveBeenCalledWith(itemData);
      expect(result).toBeInstanceOf(WorkspaceItemUser);
    });
  });

  describe('getItemsBy', () => {
    it('When getting items by criteria, then return matching items', async () => {
      const where = { workspaceId: v4() };
      const mockItems = [
        {
          id: v4(),
          itemType: WorkspaceItemType.File,
          toJSON: jest
            .fn()
            .mockReturnValue({ id: v4(), itemType: WorkspaceItemType.File }),
        },
        {
          id: v4(),
          itemType: WorkspaceItemType.Folder,
          toJSON: jest
            .fn()
            .mockReturnValue({ id: v4(), itemType: WorkspaceItemType.Folder }),
        },
      ];

      jest
        .spyOn(workspaceItemUserModel, 'findAll')
        .mockResolvedValueOnce(mockItems as any);

      const result = await repository.getItemsBy(where);

      expect(workspaceItemUserModel.findAll).toHaveBeenCalledWith({ where });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(WorkspaceItemUser);
    });
  });

  describe('updateItemBy', () => {
    it('When updating items by criteria, then call the update method', async () => {
      const where = { itemId: v4() };
      const update = { itemType: WorkspaceItemType.Folder };

      await repository.updateItemBy(where, update);

      expect(workspaceItemUserModel.update).toHaveBeenCalledWith(update, {
        where,
      });
    });
  });

  describe('deleteUserFromWorkspace', () => {
    it('When deleting user from workspace, then call destroy method', async () => {
      const memberId = v4();
      const workspaceId = v4();

      await repository.deleteUserFromWorkspace(memberId, workspaceId);

      expect(workspaceUserModel.destroy).toHaveBeenCalledWith({
        where: { memberId, workspaceId },
      });
    });
  });

  describe('getWorkspaceUsersCount', () => {
    it('When getting workspace users count, then return the count', async () => {
      const workspaceId = v4();
      const expectedCount = 5;

      jest
        .spyOn(workspaceUserModel, 'count')
        .mockResolvedValueOnce(expectedCount);

      const result = await repository.getWorkspaceUsersCount(workspaceId);

      expect(workspaceUserModel.count).toHaveBeenCalledWith({
        where: { workspaceId },
      });
      expect(result).toEqual(expectedCount);
    });
  });

  describe('createInvite', () => {
    it('When creating an invite, then return the created invite', async () => {
      const inviteData = {
        invitedUser: 'test@example.com',
        workspaceId: v4(),
        spaceLimit: 1024,
        encryptionKey: 'key',
        encryptionAlgorithm: 'algorithm',
        createdAt: new Date(),
        updatedAt: new Date(),
        toJSON: jest.fn(),
      };
      const mockCreatedInvite = { ...inviteData, id: v4() };

      jest
        .spyOn(workspaceInviteModel, 'create')
        .mockResolvedValueOnce(mockCreatedInvite as any);

      const result = await repository.createInvite(inviteData);

      expect(workspaceInviteModel.create).toHaveBeenCalledWith(inviteData);
      expect(result).toBeInstanceOf(WorkspaceInvite);
    });
  });

  describe('create', () => {
    it('When creating a workspace, then return the created workspace', async () => {
      const workspaceData = { name: 'Test Workspace', ownerId: v4() };
      const mockCreatedWorkspace = {
        ...workspaceData,
        id: v4(),
        toJSON: jest.fn().mockReturnValue(workspaceData),
      };

      jest
        .spyOn(workspaceModel, 'create')
        .mockResolvedValueOnce(mockCreatedWorkspace as any);

      const result = await repository.create(workspaceData);

      expect(workspaceModel.create).toHaveBeenCalledWith(workspaceData);
      expect(result).toBeInstanceOf(Workspace);
    });
  });

  describe('findAllBy', () => {
    it('When finding workspaces by criteria, then return matching workspaces', async () => {
      const where = { ownerId: v4() };
      const mockWorkspaces = [newWorkspace(), newWorkspace()];

      jest
        .spyOn(workspaceModel, 'findAll')
        .mockResolvedValueOnce(mockWorkspaces as any);

      const result = await repository.findAllBy(where);

      expect(workspaceModel.findAll).toHaveBeenCalledWith({ where });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Workspace);
    });
  });

  describe('addUserToWorkspace', () => {
    it('When adding user to workspace, then return the created workspace user', async () => {
      const workspaceUserData = {
        memberId: v4(),
        workspaceId: v4(),
        spaceLimit: 1024,
        driveUsage: 0,
        key: 'encrypted-key',
      };
      const mockCreatedUser = {
        ...workspaceUserData,
        id: v4(),
        toJSON: jest.fn().mockReturnValue(workspaceUserData),
        member: null,
      };

      jest
        .spyOn(workspaceUserModel, 'create')
        .mockResolvedValueOnce(mockCreatedUser as any);

      const result = await repository.addUserToWorkspace(
        workspaceUserData as any,
      );

      expect(workspaceUserModel.create).toHaveBeenCalledWith(workspaceUserData);
      expect(result).toBeInstanceOf(WorkspaceUser);
    });
  });

  describe('updateById', () => {
    it('When updating workspace by ID, then call update method', async () => {
      const workspaceId = v4();
      const update = { name: 'Updated Name' };

      await repository.updateById(workspaceId, update);

      expect(workspaceModel.update).toHaveBeenCalledWith(update, {
        where: { id: workspaceId },
        transaction: undefined,
      });
    });

    it('When updating workspace by ID with transaction, then call update method with transaction', async () => {
      const workspaceId = v4();
      const update = { name: 'Updated Name' };
      const mockTransaction = {} as any;

      await repository.updateById(workspaceId, update, mockTransaction);

      expect(workspaceModel.update).toHaveBeenCalledWith(update, {
        where: { id: workspaceId },
        transaction: mockTransaction,
      });
    });
  });

  describe('updateBy', () => {
    it('When updating workspace by criteria, then call update method', async () => {
      const where = { ownerId: v4() };
      const update = { name: 'Updated Name' };

      await repository.updateBy(where, update);

      expect(workspaceModel.update).toHaveBeenCalledWith(update, {
        where,
        transaction: undefined,
      });
    });
  });

  describe('updateWorkspaceUser', () => {
    it('When updating workspace user, then call update method', async () => {
      const workspaceUserId = v4();
      const update = { spaceLimit: 2048 };

      await repository.updateWorkspaceUser(workspaceUserId, update);

      expect(workspaceUserModel.update).toHaveBeenCalledWith(update, {
        where: { id: workspaceUserId },
      });
    });
  });

  describe('registerLog', () => {
    it('When registering a log, then create the log entry', async () => {
      const logData = {
        type: WorkspaceLogType.Login,
        creator: v4(),
        workspaceId: v4(),
        platform: WorkspaceLogPlatform.Web,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await repository.registerLog(logData);

      expect(workspaceLogModel.create).toHaveBeenCalledWith(logData);
    });
  });

  describe('findInvitesBy', () => {
    it('When finding invites with criteria, then return matching invites', async () => {
      const where = { workspaceId: v4() };
      const limit = 10;
      const offset = 0;
      const mockInvites = [newWorkspaceInvite(), newWorkspaceInvite()];

      jest
        .spyOn(workspaceInviteModel, 'findAll')
        .mockResolvedValueOnce(mockInvites as any);

      const result = await repository.findInvitesBy(where, limit, offset);

      expect(workspaceInviteModel.findAll).toHaveBeenCalledWith({
        where,
        limit,
        offset,
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(WorkspaceInvite);
    });
  });

  describe('deleteInviteBy', () => {
    it('When deleting invite by criteria, then call destroy method', async () => {
      const where = { id: v4() };

      await repository.deleteInviteBy(where);

      expect(workspaceInviteModel.destroy).toHaveBeenCalledWith({ where });
    });
  });

  describe('deleteWorkspaceInviteById', () => {
    it('When deleting invite by ID, then call destroy method', async () => {
      const inviteId = v4();

      await repository.deleteWorkspaceInviteById(inviteId);

      expect(workspaceInviteModel.destroy).toHaveBeenCalledWith({
        where: { id: inviteId },
      });
    });
  });

  describe('getItemFilesCountBy', () => {
    it('When getting files count, then return the count', async () => {
      const where = { workspaceId: v4() };
      const whereFile = { status: FileStatus.EXISTS };
      const expectedCount = 3;

      jest
        .spyOn(workspaceItemUserModel, 'count')
        .mockResolvedValueOnce(expectedCount);

      const result = await repository.getItemFilesCountBy(where, whereFile);

      expect(workspaceItemUserModel.count).toHaveBeenCalledWith({
        where: { ...where, itemType: WorkspaceItemType.File },
        include: {
          model: FileModel,
          where: whereFile,
        },
      });
      expect(result).toEqual(expectedCount);
    });
  });

  describe('getItemFoldersCountBy', () => {
    it('When getting folders count, then return the count', async () => {
      const where = { workspaceId: v4() };
      const whereFolder = { plainName: 'test-folder' };
      const expectedCount = 2;

      jest
        .spyOn(workspaceItemUserModel, 'count')
        .mockResolvedValueOnce(expectedCount);

      const result = await repository.getItemFoldersCountBy(where, whereFolder);

      expect(workspaceItemUserModel.count).toHaveBeenCalledWith({
        where: { ...where, itemType: WorkspaceItemType.Folder },
        include: {
          model: FolderModel,
          where: whereFolder,
        },
      });
      expect(result).toEqual(expectedCount);
    });
  });

  describe('findWorkspaceResourcesOwner', () => {
    it('When finding workspace resources owner, then return the owner user', async () => {
      const workspaceId = v4();
      const mockUser = newUser();
      const mockWorkspace = {
        toJSON: jest.fn().mockReturnValue({}),
        workpaceUser: {
          get: jest.fn().mockReturnValue(mockUser),
        },
      };

      jest
        .spyOn(workspaceModel, 'findOne')
        .mockResolvedValueOnce(mockWorkspace as any);

      const result = await repository.findWorkspaceResourcesOwner(workspaceId);

      expect(workspaceModel.findOne).toHaveBeenCalledWith({
        where: { id: workspaceId },
        include: {
          model: UserModel,
          as: 'workpaceUser',
        },
      });
      expect(result).toBeInstanceOf(User);
    });

    it('When workspace is not found, then return null', async () => {
      jest.spyOn(workspaceModel, 'findOne').mockResolvedValueOnce(null);

      const result = await repository.findWorkspaceResourcesOwner(v4());

      expect(result).toBeNull();
    });
  });

  describe('getItemBy', () => {
    it('When getting item by criteria, then return the item', async () => {
      const where = { itemId: v4() };
      const mockItem = {
        id: v4(),
        itemType: WorkspaceItemType.File,
        toJSON: jest
          .fn()
          .mockReturnValue({ id: v4(), itemType: WorkspaceItemType.File }),
      };

      jest
        .spyOn(workspaceItemUserModel, 'findOne')
        .mockResolvedValueOnce(mockItem as any);

      const result = await repository.getItemBy(where);

      expect(workspaceItemUserModel.findOne).toHaveBeenCalledWith({ where });
      expect(result).toBeInstanceOf(WorkspaceItemUser);
    });

    it('When item is not found, then return null', async () => {
      jest.spyOn(workspaceItemUserModel, 'findOne').mockResolvedValueOnce(null);

      const result = await repository.getItemBy({ itemId: v4() });

      expect(result).toBeNull();
    });
  });
});
