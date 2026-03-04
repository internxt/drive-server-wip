import { Test, type TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { createMock } from '@golevelup/ts-jest';
import { RoleModel, SharingModel, SharingInviteModel } from './models';
import {
  SharedWithType,
  Sharing,
  SharingInvite,
  SharingType,
} from './sharing.domain';
import { SequelizeSharingRepository } from './sharing.repository';
import {
  newFile,
  newFolder,
  newSharing,
  newUser,
  newSharingInvite,
  newRole,
  newSharingRole,
  newPermission,
} from '../../../test/fixtures';
import { v4 } from 'uuid';
import { SharingRolesModel } from './models/sharing-roles.model';
import { Op, Sequelize } from 'sequelize';
import { WorkspaceItemUserModel } from '../workspaces/models/workspace-items-users.model';
import { FileStatus } from '../file/file.domain';
import { FileModel } from '../file/file.model';
import { UserModel } from '../user/user.model';
import { FolderModel } from '../folder/folder.model';

describe('SharingRepository', () => {
  let repository: SequelizeSharingRepository;
  let sharingModel: typeof SharingModel;
  let sharingInviteModel: typeof SharingInviteModel;
  let roleModel: typeof RoleModel;
  let sharingRolesModel: typeof SharingRolesModel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizeSharingRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get<SequelizeSharingRepository>(
      SequelizeSharingRepository,
    );
    sharingModel = module.get<typeof SharingModel>(getModelToken(SharingModel));
    sharingInviteModel = module.get<typeof SharingInviteModel>(
      getModelToken(SharingInviteModel),
    );
    roleModel = module.get<typeof RoleModel>(getModelToken(RoleModel));
    sharingRolesModel = module.get<typeof SharingRolesModel>(
      getModelToken(SharingRolesModel),
    );
  });

  describe('createSharingRole', () => {
    it('When creating sharing role, then it calls the model with correct data', async () => {
      const sharingRole = newSharingRole();
      const roleData = {
        sharingId: sharingRole.sharingId,
        roleId: sharingRole.roleId,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      };

      jest
        .spyOn(sharingRolesModel, 'create')
        .mockResolvedValue(sharingRole as any);

      await repository.createSharingRole(roleData);

      expect(sharingRolesModel.create).toHaveBeenCalledWith(roleData);
    });
  });

  describe('findOneSharing', () => {
    it('When finding sharing by criteria, then it returns the sharing', async () => {
      const sharing = newSharing();
      const where = { id: sharing.id };

      jest.spyOn(sharingModel, 'findOne').mockResolvedValue(sharing as any);

      const result = await repository.findOneSharing(where);

      expect(result).toEqual(sharing);
      expect(sharingModel.findOne).toHaveBeenCalledWith({ where });
    });

    it('When sharing not found, then it returns null', async () => {
      const where = { id: 'non-existent-id' };

      jest.spyOn(sharingModel, 'findOne').mockResolvedValue(null);

      const result = await repository.findOneSharing(where);

      expect(result).toBeNull();
      expect(sharingModel.findOne).toHaveBeenCalledWith({ where });
    });
  });

  describe('deleteSharing', () => {
    it('When deleting sharing by id, then it calls destroy with correct id', async () => {
      const sharingId = v4();

      jest.spyOn(sharingModel, 'destroy').mockResolvedValue(1);

      await repository.deleteSharing(sharingId);

      expect(sharingModel.destroy).toHaveBeenCalledWith({
        where: { id: sharingId },
      });
    });
  });

  describe('deleteInvite', () => {
    it('When deleting invite, then it calls destroy with correct invite id', async () => {
      const invite = newSharingInvite();

      jest.spyOn(sharingInviteModel, 'destroy').mockResolvedValue(1);

      await repository.deleteInvite(invite);

      expect(sharingInviteModel.destroy).toHaveBeenCalledWith({
        where: { id: invite.id },
      });
    });
  });

  describe('deleteSharingRole', () => {
    it('When deleting sharing role, then it calls destroy with correct role id', async () => {
      const sharingRole = newSharingRole();

      jest.spyOn(sharingRolesModel, 'destroy').mockResolvedValue(1);

      await repository.deleteSharingRole(sharingRole);

      expect(sharingRolesModel.destroy).toHaveBeenCalledWith({
        where: { id: sharingRole.id },
      });
    });
  });

  describe('updateSharing', () => {
    it('When updating sharing, then it calls update with correct data', async () => {
      const where = { id: v4() };
      const updatedData = { encryptedPassword: 'new-password' };

      jest.spyOn(sharingModel, 'update').mockResolvedValue([1, []] as any);

      await repository.updateSharing(where, updatedData as any);

      expect(sharingModel.update).toHaveBeenCalledWith(updatedData, { where });
    });
  });

  describe('findRoles', () => {
    it('When finding all roles, then it returns roles array', async () => {
      const roles = [newRole('OWNER'), newRole('EDITOR')];

      jest.spyOn(roleModel, 'findAll').mockResolvedValue(roles as any);

      const result = await repository.findRoles();

      expect(result).toEqual(roles);
      expect(roleModel.findAll).toHaveBeenCalled();
    });
  });

  describe('findRoleBy', () => {
    it('When finding role by criteria, then it returns the role', async () => {
      const role = newRole('OWNER');
      const where = { name: 'OWNER' };

      jest.spyOn(roleModel, 'findOne').mockResolvedValue(role as any);

      const result = await repository.findRoleBy(where);

      expect(result).toEqual(role);
      expect(roleModel.findOne).toHaveBeenCalledWith({ where });
    });

    it('When role not found, then it returns null', async () => {
      const where = { name: 'NON_EXISTENT' };

      jest.spyOn(roleModel, 'findOne').mockResolvedValue(null);

      const result = await repository.findRoleBy(where);

      expect(result).toBeNull();
      expect(roleModel.findOne).toHaveBeenCalledWith({ where });
    });
  });

  describe('findSharingById', () => {
    it('When finding sharing by id, then it returns sharing', async () => {
      const sharing = newSharing();
      const sharingId = sharing.id;

      jest.spyOn(sharingModel, 'findByPk').mockResolvedValue(sharing as any);

      const result = await repository.findSharingById(sharingId);

      expect(result).toEqual(sharing);
      expect(sharingModel.findByPk).toHaveBeenCalledWith(sharingId);
    });
  });

  describe('findSharingRoleBy', () => {
    it('When finding sharing role by criteria, then it returns the role with includes', async () => {
      const sharingRole = newSharingRole();
      const role = newRole('EDITOR');
      sharingRole.role = role;
      const where = { sharingId: sharingRole.sharingId };

      jest
        .spyOn(sharingRolesModel, 'findOne')
        .mockResolvedValue(sharingRole as any);

      const result = await repository.findSharingRoleBy(where);

      expect(result).toEqual(sharingRole);
      expect(sharingRolesModel.findOne).toHaveBeenCalledWith({
        where,
        include: [
          {
            model: RoleModel,
            as: 'role',
          },
        ],
      });
    });
  });

  describe('getInvites', () => {
    it('When getting invites by item, then it returns invites with user data', async () => {
      const invite = newSharingInvite();
      const user = newUser();
      const where = { itemId: invite.itemId, itemType: invite.itemType };
      const limit = 10;
      const offset = 0;

      const inviteWithUser = {
        ...invite,
        toJSON: jest.fn().mockReturnValue({
          ...invite,
          invited: {
            uuid: user.uuid,
            email: user.email,
            name: user.name,
            lastname: user.lastname,
            avatar: user.avatar,
          },
        }),
      };

      jest
        .spyOn(sharingInviteModel, 'findAll')
        .mockResolvedValue([inviteWithUser] as any);

      const result = await repository.getInvites(where, limit, offset);

      expect(result).toHaveLength(1);
      expect(sharingInviteModel.findAll).toHaveBeenCalledWith({
        where,
        limit,
        offset,
        nest: true,
        include: [
          {
            model: UserModel,
            as: 'invited',
            attributes: ['uuid', 'email', 'name', 'lastname', 'avatar'],
            required: true,
          },
        ],
      });
    });
  });

  describe('getUserValidInvites', () => {
    it('When getting valid invites, then it filters by file and folder validity', async () => {
      const invite = newSharingInvite();
      const user = newUser();
      const where = { sharedWith: user.uuid };
      const limit = 10;
      const offset = 0;

      const inviteWithUser = {
        ...invite,
        toJSON: jest.fn().mockReturnValue({
          ...invite,
          invited: {
            uuid: user.uuid,
            email: user.email,
            name: user.name,
            lastname: user.lastname,
            avatar: user.avatar,
          },
        }),
      };

      jest
        .spyOn(sharingInviteModel, 'findAll')
        .mockResolvedValue([inviteWithUser] as any);

      const result = await repository.getUserValidInvites(where, limit, offset);

      expect(result).toHaveLength(1);
      expect(sharingInviteModel.findAll).toHaveBeenCalledWith({
        where: {
          ...where,
          [Op.or]: [
            {
              [Op.and]: [
                { itemType: 'file' },
                { '$file.status$': FileStatus.EXISTS },
              ],
            },
            {
              [Op.and]: [
                { itemType: 'folder' },
                { '$folder.deleted$': false },
                { '$folder.removed$': false },
              ],
            },
          ],
        },
        limit,
        offset,
        include: [
          {
            model: FileModel,
            as: 'file',
            attributes: [],
          },
          {
            model: FolderModel,
            as: 'folder',
            attributes: [],
          },
          {
            model: UserModel,
            as: 'invited',
            attributes: ['uuid', 'email', 'name', 'lastname', 'avatar'],
            required: true,
          },
        ],
        nest: true,
      });
    });
  });

  describe('getInviteById', () => {
    it('When getting invite by id, then it returns invite with role', async () => {
      const invite = newSharingInvite();
      const role = newRole('EDITOR');
      invite.roleId = role.id;

      jest
        .spyOn(sharingInviteModel, 'findOne')
        .mockResolvedValue(invite as any);

      const result = await repository.getInviteById(invite.id);

      expect(result).toEqual(SharingInvite.build(invite));
      expect(sharingInviteModel.findOne).toHaveBeenCalledWith({
        where: {
          id: invite.id,
        },
      });
    });
  });

  describe('bulkDeleteInvites', () => {
    it('When bulk deleting invites, then it calls destroy with correct criteria', async () => {
      const itemIds = [v4(), v4()];
      const itemType = 'file' as const;

      jest.spyOn(sharingInviteModel, 'destroy').mockResolvedValue(2);

      await repository.bulkDeleteInvites(itemIds, itemType);

      expect(sharingInviteModel.destroy).toHaveBeenCalledWith({
        where: {
          itemId: {
            [Op.in]: itemIds,
          },
          itemType,
        },
      });
    });
  });

  describe('bulkDeleteSharings', () => {
    it('When bulk deleting sharings, then it calls destroy with correct criteria', async () => {
      const ownerUuid = v4();
      const itemIds = [v4(), v4()];
      const itemType = 'file' as const;
      const sharedWithType = SharedWithType.Individual;

      jest.spyOn(sharingModel, 'destroy').mockResolvedValue(2);

      await repository.bulkDeleteSharings(
        ownerUuid,
        itemIds,
        itemType,
        sharedWithType,
      );

      expect(sharingModel.destroy).toHaveBeenCalledWith({
        where: {
          ownerId: ownerUuid,
          itemId: {
            [Op.in]: itemIds,
          },
          itemType,
          sharedWithType,
        },
      });
    });
  });

  describe('findPermissionsInSharing', () => {
    it('When finding permissions in sharing, then it returns permissions array', async () => {
      const sharedWith = v4();
      const sharedWithType = SharedWithType.Individual;
      const resourceId = v4();
      const permissions = [newPermission()];

      jest
        .spyOn(repository, 'findPermissionsInSharing')
        .mockResolvedValue(permissions);

      const result = await repository.findPermissionsInSharing(
        sharedWith,
        sharedWithType,
        resourceId,
      );

      expect(result).toEqual(permissions);
      expect(repository.findPermissionsInSharing).toHaveBeenCalledWith(
        sharedWith,
        sharedWithType,
        resourceId,
      );
    });
  });

  describe('getSharingsCountBy', () => {
    it('When getting sharings count, then it returns count number', async () => {
      const where = { ownerId: v4() };
      const expectedCount = 5;

      jest.spyOn(sharingModel, 'count').mockResolvedValue(expectedCount);

      const result = await repository.getSharingsCountBy(where);

      expect(result).toBe(expectedCount);
      expect(sharingModel.count).toHaveBeenCalledWith({ where });
    });
  });

  describe('getInvitesCountBy', () => {
    it('When getting invites count, then it returns count number', async () => {
      const where = { sharedWith: v4() };
      const expectedCount = 3;

      jest.spyOn(sharingInviteModel, 'count').mockResolvedValue(expectedCount);

      const result = await repository.getInvitesCountBy(where);

      expect(result).toBe(expectedCount);
      expect(sharingInviteModel.count).toHaveBeenCalledWith({ where });
    });
  });

  describe('findOneByOwnerOrSharedWithItem', () => {
    it('When finding sharing by owner or shared with item, then it returns sharing', async () => {
      const ownerUuid = v4();
      const itemId = v4();
      const itemType = 'file' as const;
      const sharingType = SharingType.Public;
      const sharing = newSharing();

      jest.spyOn(sharingModel, 'findOne').mockResolvedValue(sharing as any);

      const result = await repository.findOneByOwnerOrSharedWithItem(
        ownerUuid,
        itemId,
        itemType,
        sharingType,
      );

      expect(result).toEqual(sharing);
      expect(sharingModel.findOne).toHaveBeenCalledWith({
        where: {
          [Op.or]: [{ ownerId: ownerUuid }, { sharedWith: ownerUuid }],
          itemId,
          itemType,
          type: sharingType,
        },
      });
    });
  });

  describe('getInvitesNumberByItem', () => {
    it('When getting invites number by item, then it returns count', async () => {
      const itemId = v4();
      const itemType = 'file' as const;
      const expectedCount = 2;

      jest.spyOn(sharingInviteModel, 'count').mockResolvedValue(expectedCount);

      const result = await repository.getInvitesNumberByItem(itemId, itemType);

      expect(result).toBe(expectedCount);
      expect(sharingInviteModel.count).toHaveBeenCalledWith({
        where: { itemId, itemType },
      });
    });
  });

  describe('deleteInvitesBy', () => {
    it('When deleting invites by criteria, then it calls destroy with correct where clause', async () => {
      const where = { itemId: v4(), itemType: 'file' as const };

      jest.spyOn(sharingInviteModel, 'destroy').mockResolvedValue(2);

      await repository.deleteInvitesBy(where);

      expect(sharingInviteModel.destroy).toHaveBeenCalledWith({ where });
    });
  });

  describe('deleteSharingsBy', () => {
    it('When deleting sharings by criteria, then it calls destroy with correct where clause', async () => {
      const where = { itemId: v4(), itemType: 'file' as const };

      jest.spyOn(sharingModel, 'destroy').mockResolvedValue(2);

      await repository.deleteSharingsBy(where);

      expect(sharingModel.destroy).toHaveBeenCalledWith({ where });
    });
  });

  describe('findSharingsBySharedWithAndAttributes', () => {
    it('When filters are included, then it should call the query with the correct filters', async () => {
      const sharedWithValues = [v4(), v4()];
      const filters = { sharedWithType: SharedWithType.Individual };
      const offset = 0;
      const limit = 10;

      const expectedQuery = {
        where: {
          ...filters,
          sharedWith: {
            [Op.in]: sharedWithValues,
          },
        },
        include: [
          {
            model: SharingRolesModel,
            include: [RoleModel],
          },
        ],
        limit,
        offset,
        order: [],
        replacements: {
          priorityRole: undefined,
        },
      };

      await repository.findSharingsBySharedWithAndAttributes(
        sharedWithValues,
        filters,
        { offset, limit },
      );

      expect(sharingModel.findAll).toHaveBeenCalledWith(expectedQuery);
    });

    it('When givePriorityToRole is provided, then it should call the query prioritizing the role', async () => {
      const sharedWithValues = [v4(), v4()];
      const filters = {};
      const offset = 0;
      const limit = 10;
      const givePriorityToRole = 'admin';

      const expectedQuery = {
        where: {
          ...filters,
          sharedWith: {
            [Op.in]: sharedWithValues,
          },
        },
        include: [
          {
            model: SharingRolesModel,
            include: [RoleModel],
          },
        ],
        limit,
        offset,
      };

      await repository.findSharingsBySharedWithAndAttributes(
        sharedWithValues,
        filters,
        { offset, limit, givePriorityToRole },
      );

      expect(sharingModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          ...expectedQuery,
          order: [
            [
              {
                val: expect.stringContaining(
                  `CASE WHEN "role->role"."name" = :priorityRole THEN 1 ELSE 2 END`,
                ),
              },
              'ASC',
            ],
          ],
          replacements: {
            priorityRole: givePriorityToRole,
          },
        }),
      );
    });

    it('When no results are found, then it should return an empty array', async () => {
      const sharedWithValues = [v4(), v4()];
      const filters = {};
      const offset = 0;
      const limit = 10;

      jest.spyOn(sharingModel, 'findAll').mockResolvedValue([]);

      const result = await repository.findSharingsBySharedWithAndAttributes(
        sharedWithValues,
        filters,
        { offset, limit },
      );

      expect(result).toEqual([]);
    });
  });

  describe('findFilesSharedInWorkspaceByOwnerAndTeams', () => {
    const ownerId = v4();
    const workspaceId = v4();
    const teamIds = [v4(), v4()];
    const offset = 0;
    const limit = 10;

    it('When called, then it should call the query with the correct owner, teams and order', async () => {
      const orderBy: [string, string][] = [['name', 'ASC']];

      const expectedQuery = {
        where: {
          [Op.or]: [
            {
              sharedWith: { [Op.in]: teamIds },
              sharedWithType: SharedWithType.WorkspaceTeam,
            },
            {
              '$file->workspaceUser.created_by$': ownerId,
            },
          ],
        },
        attributes: [
          [Sequelize.literal('MAX("SharingModel"."created_at")'), 'createdAt'],
        ],
        group: [
          'SharingModel.item_id',
          'file.id',
          'file->workspaceUser.id',
          'file->workspaceUser->creator.id',
        ],
        include: [
          {
            model: FileModel,
            where: {
              status: FileStatus.EXISTS,
            },
            include: [
              {
                model: WorkspaceItemUserModel,
                as: 'workspaceUser',
                required: true,
                where: {
                  workspaceId,
                },
                include: [
                  {
                    model: UserModel,
                    as: 'creator',
                    attributes: ['uuid', 'email', 'name', 'lastname', 'avatar'],
                  },
                ],
              },
            ],
          },
        ],
        order: orderBy,
        limit,
        offset,
      };

      await repository.findFilesSharedInWorkspaceByOwnerAndTeams(
        ownerId,
        workspaceId,
        teamIds,
        { offset, limit, order: orderBy },
      );

      expect(sharingModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining(expectedQuery),
      );
    });

    it('When returned successfully, then it returns a folder and its creator', async () => {
      const sharing = newSharing();
      const file = newFile();
      const creator = newUser();

      const sharedFileWithUser = {
        ...sharing,
        get: jest.fn().mockReturnValue({
          ...sharing,
          file: {
            ...file,
            workspaceUser: {
              creator,
            },
          },
        }),
      };

      jest
        .spyOn(sharingModel, 'findAll')
        .mockResolvedValue([sharedFileWithUser] as any);

      const result = await repository.findFilesSharedInWorkspaceByOwnerAndTeams(
        ownerId,
        workspaceId,
        teamIds,
        { offset, limit },
      );

      expect(result[0].file).toMatchObject({
        ...file,
        user: {
          uuid: creator.uuid,
          email: creator.email,
          name: creator.name,
          lastname: creator.lastname,
          avatar: creator.avatar,
        },
      });
    });
  });

  describe('findFoldersSharedInWorkspaceByOwnerAndTeams', () => {
    const ownerId = v4();
    const workspaceId = v4();
    const teamIds = [v4(), v4()];
    const offset = 0;
    const limit = 10;

    it('When called, then it should call the query with the correct owner, teams and order', async () => {
      const orderBy: [string, string][] = [['plainName', 'ASC']];

      const expectedQuery = {
        where: {
          [Op.or]: [
            {
              sharedWith: { [Op.in]: teamIds },
              sharedWithType: SharedWithType.WorkspaceTeam,
            },
            {
              '$folder->workspaceUser.created_by$': ownerId,
            },
          ],
        },
        attributes: [
          [Sequelize.literal('MAX("SharingModel"."created_at")'), 'createdAt'],
        ],
        group: [
          'SharingModel.item_id',
          'folder.id',
          'folder->workspaceUser.id',
          'folder->workspaceUser->creator.id',
        ],
        include: [
          {
            model: FolderModel,
            where: {
              deleted: false,
              removed: false,
            },
            include: [
              {
                model: WorkspaceItemUserModel,
                required: true,
                where: {
                  workspaceId,
                },
                include: [
                  {
                    model: UserModel,
                    as: 'creator',
                    attributes: ['uuid', 'email', 'name', 'lastname', 'avatar'],
                  },
                ],
              },
            ],
          },
        ],
        order: orderBy,
        limit,
        offset,
      };

      await repository.findFoldersSharedInWorkspaceByOwnerAndTeams(
        ownerId,
        workspaceId,
        teamIds,
        { offset, limit, order: orderBy },
      );

      expect(sharingModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining(expectedQuery),
      );
    });

    it('When returned successfully, then it returns a folder and its creator', async () => {
      const orderBy: [string, string][] = [['plainName', 'ASC']];
      const sharedFolder = newSharing();
      const folder = newFolder();
      const creator = newUser();

      const sharedFolderWithUser = {
        ...sharedFolder,
        get: jest.fn().mockReturnValue({
          ...sharedFolder,
          folder: {
            ...folder,
            workspaceUser: {
              creator,
            },
          },
        }),
      };

      jest
        .spyOn(sharingModel, 'findAll')
        .mockResolvedValue([sharedFolderWithUser] as any);

      const result =
        await repository.findFoldersSharedInWorkspaceByOwnerAndTeams(
          ownerId,
          workspaceId,
          teamIds,
          { offset, limit, order: orderBy },
        );

      expect(result[0]).toBeInstanceOf(Sharing);
      expect(result[0].folder).toMatchObject({
        ...folder,
        user: {
          uuid: creator.uuid,
          email: creator.email,
          name: creator.name,
          lastname: creator.lastname,
          avatar: creator.avatar,
        },
      });
    });
  });

  describe('findSharingRole', () => {
    it('When finding sharing role by id, then it returns the role', async () => {
      const sharingRole = newSharingRole();

      jest
        .spyOn(sharingRolesModel, 'findByPk')
        .mockResolvedValue(sharingRole as any);

      const result = await repository.findSharingRole(sharingRole.id);

      expect(result).toEqual(sharingRole);
      expect(sharingRolesModel.findByPk).toHaveBeenCalledWith(sharingRole.id);
    });

    it('When sharing role not found, then it returns null', async () => {
      const roleId = v4();

      jest.spyOn(sharingRolesModel, 'findByPk').mockResolvedValue(null);

      const result = await repository.findSharingRole(roleId);

      expect(result).toBeNull();
      expect(sharingRolesModel.findByPk).toHaveBeenCalledWith(roleId);
    });
  });

  describe('findSharingsWithRolesByItem', () => {
    it('When finding sharings with roles by file item, then it returns sharings with roles', async () => {
      const file = newFile();
      const sharing = newSharing();
      const role = newRole('EDITOR');

      jest.spyOn(repository, 'findSharingsWithRoles').mockResolvedValue([
        {
          ...sharing,
          role,
        },
      ]);

      const result = await repository.findSharingsWithRolesByItem(file);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ...sharing,
        role,
      });
      expect(repository.findSharingsWithRoles).toHaveBeenCalledWith({
        itemId: file.uuid,
        itemType: 'file',
        sharedWith: {
          [Op.not]: '00000000-0000-0000-0000-000000000000',
        },
      });
    });

    it('When finding sharings with roles by folder item, then it returns sharings with roles', async () => {
      const folder = newFolder();
      const sharing = newSharing();
      const role = newRole('OWNER');

      jest.spyOn(repository, 'findSharingsWithRoles').mockResolvedValue([
        {
          ...sharing,
          role,
        },
      ]);

      const result = await repository.findSharingsWithRolesByItem(folder);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ...sharing,
        role,
      });
      expect(repository.findSharingsWithRoles).toHaveBeenCalledWith({
        itemId: folder.uuid,
        itemType: 'folder',
        sharedWith: {
          [Op.not]: '00000000-0000-0000-0000-000000000000',
        },
      });
    });
  });

  describe('findByOwnerOrSharedWithFolderId', () => {
    it('When finding by owner or shared with folder id, then it returns sharings', async () => {
      const userId = v4();
      const itemId = v4();
      const sharing = newSharing();
      const offset = 0;
      const limit = 10;
      const orderBy: [string, string][] = [['createdAt', 'DESC']];

      const sharingWithGet = {
        ...sharing,
        get: jest.fn().mockReturnValue(sharing),
      };

      jest
        .spyOn(sharingModel, 'findAll')
        .mockResolvedValue([sharingWithGet] as any);

      const result = await repository.findByOwnerOrSharedWithFolderId(
        userId,
        itemId,
        offset,
        limit,
        orderBy,
      );

      expect(result).toHaveLength(1);
      expect(sharingModel.findAll).toHaveBeenCalledWith({
        where: {
          itemId,
          [Op.or]: [{ ownerId: userId }, { sharedWith: userId }],
        },
        order: orderBy,
        limit,
        offset,
      });
    });
  });

  describe('updateSharingRole', () => {
    it('When updating sharing role, then it calls update with correct data', async () => {
      const sharingRoleId = v4();
      const update = { roleId: v4() };

      jest.spyOn(sharingRolesModel, 'update').mockResolvedValue([1] as any);

      await repository.updateSharingRole(sharingRoleId, update);

      expect(sharingRolesModel.update).toHaveBeenCalledWith(update, {
        where: { id: sharingRoleId },
      });
    });
  });

  describe('updateSharingRoleBy', () => {
    it('When updating sharing role by criteria, then it calls update with correct data', async () => {
      const where = { sharingId: v4() };
      const update = { roleId: v4() };

      jest.spyOn(sharingRolesModel, 'update').mockResolvedValue([1] as any);

      await repository.updateSharingRoleBy(where, update);

      expect(sharingRolesModel.update).toHaveBeenCalledWith(update, { where });
    });
  });

  describe('findOneSharingBy', () => {
    it('When finding one sharing by criteria, then it returns sharing domain object', async () => {
      const sharing = newSharing();
      const where = { id: sharing.id };

      jest.spyOn(sharingModel, 'findOne').mockResolvedValue(sharing as any);

      const result = await repository.findOneSharingBy(where);

      expect(result).toEqual(Sharing.build(sharing));
      expect(sharingModel.findOne).toHaveBeenCalledWith({ where });
    });

    it('When sharing not found, then it returns null', async () => {
      const where = { id: 'non-existent-id' };

      jest.spyOn(sharingModel, 'findOne').mockResolvedValue(null);

      const result = await repository.findOneSharingBy(where);

      expect(result).toBeNull();
      expect(sharingModel.findOne).toHaveBeenCalledWith({ where });
    });
  });

  describe('findSharingsWithRolesBySharedWith', () => {
    it('When finding sharings with roles by shared with users, then it returns sharings with roles', async () => {
      const users = [newUser(), newUser()];
      const sharing = newSharing();
      const role = newRole('VIEWER');

      jest.spyOn(repository, 'findSharingsWithRoles').mockResolvedValue([
        {
          ...sharing,
          role,
        },
      ]);

      const result = await repository.findSharingsWithRolesBySharedWith(users);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ...sharing,
        role,
      });
      expect(repository.findSharingsWithRoles).toHaveBeenCalledWith({
        sharedWith: {
          [Op.in]: users.map((user) => user.uuid),
        },
      });
    });
  });

  describe('findAllSharing', () => {
    it('When finding all sharings, then it returns folders with sharing info', async () => {
      const where = { ownerId: v4() };
      const offset = 0;
      const limit = 10;
      const orderBy: [string, string][] = [['createdAt', 'DESC']];
      const sharing = newSharing();
      const folder = newFolder();
      const owner = newUser();

      const sharedFolderWithData = {
        ...sharing,
        folder,
        owner,
        get: jest.fn().mockReturnValue({
          ...sharing,
          folder,
          owner,
        }),
      };

      jest
        .spyOn(sharingModel, 'findAll')
        .mockResolvedValue([sharedFolderWithData] as any);

      const result = await repository.findAllSharing(
        where,
        offset,
        limit,
        orderBy,
      );

      expect(result).toHaveLength(1);
      expect(sharingModel.findAll).toHaveBeenCalledWith({
        where,
        include: [
          {
            model: FolderModel,
            where: {
              deleted: false,
              removed: false,
            },
          },
          {
            model: UserModel,
            foreignKey: 'ownerId',
            as: 'owner',
            attributes: ['uuid', 'email', 'name', 'lastname', 'avatar'],
          },
        ],
        order: orderBy,
        limit,
        offset,
      });
    });
  });

  describe('findSharingByItemAndSharedWith', () => {
    it('When finding sharing by item and shared with, then it returns sharing', async () => {
      const itemId = v4();
      const sharedWith = v4();
      const sharing = newSharing();

      jest.spyOn(sharingModel, 'findOne').mockResolvedValue(sharing as any);

      const result = await repository.findSharingByItemAndSharedWith(
        itemId,
        sharedWith,
      );

      expect(result).toEqual(Sharing.build(sharing));
      expect(sharingModel.findOne).toHaveBeenCalledWith({
        where: {
          itemId,
          sharedWith,
        },
      });
    });

    it('When sharing not found, then it returns null', async () => {
      const itemId = v4();
      const sharedWith = v4();

      jest.spyOn(sharingModel, 'findOne').mockResolvedValue(null);

      const result = await repository.findSharingByItemAndSharedWith(
        itemId,
        sharedWith,
      );

      expect(result).toBeNull();
    });
  });

  describe('createInvite', () => {
    it('When creating invite, then it returns created invite', async () => {
      const inviteData = {
        itemId: v4(),
        itemType: 'file' as const,
        sharedWith: 'user@example.com',
        roleId: v4(),
      };
      const createdInvite = newSharingInvite();

      jest
        .spyOn(sharingInviteModel, 'create')
        .mockResolvedValue(createdInvite as any);

      const result = await repository.createInvite(inviteData as any);

      expect(result).toEqual(SharingInvite.build(createdInvite));
      expect(sharingInviteModel.create).toHaveBeenCalledWith(inviteData);
    });
  });

  describe('createSharing', () => {
    it('When creating sharing, then it returns created sharing', async () => {
      const sharingData = {
        itemId: v4(),
        itemType: 'folder' as const,
        ownerId: v4(),
        sharedWith: v4(),
        sharedWithType: SharedWithType.Individual,
        type: SharingType.Private,
      };
      const createdSharing = newSharing();

      jest
        .spyOn(sharingModel, 'create')
        .mockResolvedValue(createdSharing as any);

      const result = await repository.createSharing(sharingData as any);

      expect(result).toEqual(Sharing.build(createdSharing));
      expect(sharingModel.create).toHaveBeenCalledWith(sharingData);
    });
  });

  describe('getInvitesByItem', () => {
    it('When getting invites by item, then it returns invites array', async () => {
      const itemId = v4();
      const itemType = 'file' as const;
      const invites = [newSharingInvite(), newSharingInvite()];

      const invitesWithGet = invites.map((invite) => ({
        ...invite,
        get: jest.fn().mockReturnValue(invite),
      }));

      jest
        .spyOn(sharingInviteModel, 'findAll')
        .mockResolvedValue(invitesWithGet as any);

      const result = await repository.getInvitesByItem(itemId, itemType);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(SharingInvite);
      expect(sharingInviteModel.findAll).toHaveBeenCalledWith({
        where: {
          itemId,
          itemType,
        },
      });
    });
  });

  describe('getInviteByItemAndUser', () => {
    it('When getting invite by item and user, then it returns invite', async () => {
      const itemId = v4();
      const itemType = 'folder' as const;
      const sharedWith = 'user@example.com';
      const invite = newSharingInvite();

      jest
        .spyOn(sharingInviteModel, 'findOne')
        .mockResolvedValue(invite as any);

      const result = await repository.getInviteByItemAndUser(
        itemId,
        itemType,
        sharedWith,
      );

      expect(result).toEqual(SharingInvite.build(invite));
      expect(sharingInviteModel.findOne).toHaveBeenCalledWith({
        where: {
          itemId,
          itemType,
          sharedWith,
        },
      });
    });

    it('When invite not found, then it returns null', async () => {
      const itemId = v4();
      const itemType = 'folder' as const;
      const sharedWith = 'user@example.com';

      jest.spyOn(sharingInviteModel, 'findOne').mockResolvedValue(null);

      const result = await repository.getInviteByItemAndUser(
        itemId,
        itemType,
        sharedWith,
      );

      expect(result).toBeNull();
    });
  });

  describe('getSharedItemsNumberByUser', () => {
    it('When getting shared items number by user, then it returns count', async () => {
      const userUuid = v4();
      const expectedCount = 5;

      jest.spyOn(sharingModel, 'count').mockResolvedValue(expectedCount);

      const result = await repository.getSharedItemsNumberByUser(userUuid);

      expect(result).toBe(expectedCount);
      expect(sharingModel.count).toHaveBeenCalledWith({
        where: { ownerId: userUuid },
        distinct: true,
        col: 'itemId',
      });
    });
  });

  describe('deleteSharingRolesBySharing', () => {
    it('When deleting sharing roles by sharing, then it calls destroy with sharing id', async () => {
      const sharing = newSharing();

      jest.spyOn(sharingRolesModel, 'destroy').mockResolvedValue(2);

      await repository.deleteSharingRolesBySharing(sharing);

      expect(sharingRolesModel.destroy).toHaveBeenCalledWith({
        where: {
          sharingId: sharing.id,
        },
      });
    });
  });

  describe('updateAllUserSharedWith', () => {
    it('When updating all user shared with, then it calls update with correct data', async () => {
      const userUuid = v4();
      const update = { sharedWith: 'new-email@example.com' };

      jest.spyOn(sharingInviteModel, 'update').mockResolvedValue([2] as any);

      await repository.updateAllUserSharedWith(userUuid, update);

      expect(sharingInviteModel.update).toHaveBeenCalledWith(update, {
        where: {
          sharedWith: userUuid,
        },
      });
    });
  });

  describe('getInvitesBySharedwith', () => {
    it('When getting invites by shared with, then it returns invites array', async () => {
      const userUuid = v4();
      const invites = [newSharingInvite(), newSharingInvite()];

      const invitesWithToJSON = invites.map((invite) => ({
        ...invite,
        toJSON: jest.fn().mockReturnValue(invite),
      }));

      jest
        .spyOn(sharingInviteModel, 'findAll')
        .mockResolvedValue(invitesWithToJSON as any);

      const result = await repository.getInvitesBySharedwith(userUuid);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(SharingInvite);
      expect(sharingInviteModel.findAll).toHaveBeenCalledWith({
        where: {
          sharedWith: userUuid,
        },
      });
    });
  });

  describe('bulkUpdate', () => {
    it('When bulk updating invites, then it calls update for each invite', async () => {
      const invites = [
        {
          id: v4(),
          sharedWith: 'user1@example.com',
          encryptionKey: 'key1',
        },
        {
          id: v4(),
          sharedWith: 'user2@example.com',
          encryptionKey: 'key2',
        },
      ];

      jest.spyOn(sharingInviteModel, 'update').mockResolvedValue([1] as any);

      await repository.bulkUpdate(invites);

      expect(sharingInviteModel.update).toHaveBeenCalledTimes(2);
      expect(sharingInviteModel.update).toHaveBeenNthCalledWith(
        1,
        {
          sharedWith: invites[0].sharedWith,
          encryptionKey: invites[0].encryptionKey,
        },
        {
          where: {
            id: invites[0].id,
          },
        },
      );
      expect(sharingInviteModel.update).toHaveBeenNthCalledWith(
        2,
        {
          sharedWith: invites[1].sharedWith,
          encryptionKey: invites[1].encryptionKey,
        },
        {
          where: {
            id: invites[1].id,
          },
        },
      );
    });
  });

  describe('getUserRelatedSharedFilesInfo', () => {
    it('When getting user related shared files info, then it returns data', async () => {
      const userId = v4();
      const offset = 0;
      const limit = 10;
      const itemId1 = v4();
      const itemId2 = v4();
      const encryptionKey1 = 'encryption-key-1';
      const encryptionKey2 = 'encryption-key-2';
      const createdAt1 = new Date();
      const createdAt2 = new Date();

      const mockResults = [
        {
          itemId: itemId1,
          encryptionKey: encryptionKey1,
          createdAt: createdAt1,
        },
        {
          itemId: itemId2,
          encryptionKey: encryptionKey2,
          createdAt: createdAt2,
        },
      ];

      jest.spyOn(sharingModel, 'findAll').mockResolvedValue(mockResults as any);

      const result = await repository.getUserRelatedSharedFilesInfo(
        userId,
        offset,
        limit,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        itemId: itemId1,
        encryptionKey: encryptionKey1,
        createdAt: createdAt1,
      });
      expect(result[1]).toEqual({
        itemId: itemId2,
        encryptionKey: encryptionKey2,
        createdAt: createdAt2,
      });
      expect(sharingModel.findAll).toHaveBeenCalledWith({
        attributes: [
          'itemId',
          [
            Sequelize.literal('MAX("SharingModel"."encryption_key")'),
            'encryptionKey',
          ],
          [Sequelize.literal('MAX("SharingModel"."created_at")'), 'createdAt'],
        ],
        where: {
          [Op.or]: [{ ownerId: userId }, { sharedWith: userId }],
        },
        group: ['itemId'],
        include: [
          {
            model: FileModel,
            attributes: [],
            where: {
              status: FileStatus.EXISTS,
            },
          },
        ],
        limit,
        offset,
      });
    });

    it('When called with pagination parameters, then it uses correct offset and limit', async () => {
      const userId = v4();
      const offset = 50;
      const limit = 25;

      jest.spyOn(sharingModel, 'findAll').mockResolvedValue([]);

      await repository.getUserRelatedSharedFilesInfo(userId, offset, limit);

      expect(sharingModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 25,
          offset: 50,
        }),
      );
    });
  });

  describe('getTeamsRelatedSharedFilesInfo', () => {
    it('When getting teams related shared files info, then it makes query with expected arguments', async () => {
      const ownerId = v4();
      const teamIds = [v4(), v4()];
      const workspaceId = v4();
      const offset = 0;
      const limit = 10;
      const options = { offset, limit };

      jest.spyOn(sharingModel, 'findAll').mockResolvedValue([]);

      await repository.getTeamsRelatedSharedFilesInfo(
        ownerId,
        teamIds,
        workspaceId,
        options,
      );

      expect(sharingModel.findAll).toHaveBeenCalledWith({
        attributes: [
          'itemId',
          [
            Sequelize.literal('MAX("SharingModel"."encryption_key")'),
            'encryptionKey',
          ],
          [Sequelize.literal('MIN("SharingModel"."created_at")'), 'createdAt'],
        ],
        where: {
          [Op.or]: [
            {
              sharedWith: { [Op.in]: teamIds },
              sharedWithType: SharedWithType.WorkspaceTeam,
            },
            {
              '$file->workspaceUser.created_by$': ownerId,
            },
          ],
        },
        group: ['itemId'],
        include: [
          {
            model: FileModel,
            attributes: [],
            where: {
              status: FileStatus.EXISTS,
            },
            include: [
              {
                model: WorkspaceItemUserModel,
                as: 'workspaceUser',
                where: {
                  workspaceId,
                },
                attributes: [],
              },
            ],
          },
        ],
        limit,
        offset,
      });
    });

    it('When called with different pagination, then it uses correct offset and limit', async () => {
      const ownerId = v4();
      const teamIds = [v4()];
      const workspaceId = v4();
      const offset = 20;
      const limit = 5;
      const options = { offset, limit };

      jest.spyOn(sharingModel, 'findAll').mockResolvedValue([]);

      await repository.getTeamsRelatedSharedFilesInfo(
        ownerId,
        teamIds,
        workspaceId,
        options,
      );

      expect(sharingModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 20,
        }),
      );
    });
  });
});
