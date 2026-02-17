import { createMock } from '@golevelup/ts-jest';
import { CalculateFolderSizeTimeoutException } from './exception/calculate-folder-size-timeout.exception';
import { SequelizeFolderRepository } from './folder.repository';
import { FolderModel } from './folder.model';
import { Folder } from './folder.domain';
import { FolderAttributes } from './folder.attributes';
import { newFolder, newUser } from '../../../test/fixtures';
import { FileStatus } from '../file/file.domain';
import { Op, QueryTypes } from 'sequelize';
import { WorkspaceItemUserModel } from '../workspaces/models/workspace-items-users.model';
import { WorkspaceItemType } from '../workspaces/attributes/workspace-items-users.attributes';
import { UserModel } from '../user/user.model';
import { SharingModel } from '../sharing/models';
import { v4 } from 'uuid';
import { randomInt } from 'crypto';

jest.mock('./folder.model', () => ({
  FolderModel: {
    sequelize: {
      query: jest.fn(() => Promise.resolve([[{ totalsize: 100 }]])),
    },
  },
}));

describe('SequelizeFolderRepository', () => {
  const TIMEOUT_ERROR_CODE = '57014';

  let repository: SequelizeFolderRepository;
  let folderModel: typeof FolderModel;
  let folder: Folder;

  beforeEach(async () => {
    folderModel = createMock<typeof FolderModel>();

    repository = new SequelizeFolderRepository(folderModel);

    folder = newFolder();
  });

  describe('calculate folder size', () => {
    it('When calculate folder size is requested, then it works', async () => {
      const calculateSizeQuery = `
      WITH RECURSIVE folder_recursive AS (
        SELECT
          fl1.uuid,
          fl1.parent_uuid,
          1 AS row_num,
          fl1.user_id as owner_id
        FROM folders fl1
        WHERE fl1.uuid = :folderUuid
          AND fl1.removed = FALSE
          AND fl1.deleted = FALSE

        UNION ALL

        SELECT
          fl2.uuid,
          fl2.parent_uuid,
          fr.row_num + 1,
          fr.owner_id
        FROM folders fl2
        INNER JOIN folder_recursive fr ON fr.uuid = fl2.parent_uuid
        WHERE fr.row_num < 100000
          AND fl2.user_id = fr.owner_id
          AND fl2.removed = FALSE
          AND fl2.deleted = FALSE
      )
      SELECT COALESCE(SUM(f.size), 0) AS totalsize
      FROM folder_recursive fr
      LEFT JOIN files f
        ON f.folder_uuid = fr.uuid
        AND f.status IN (:fileStatusCondition);
      `;

      jest
        .spyOn(FolderModel.sequelize, 'query')
        .mockResolvedValue([[{ totalsize: 100 }]] as any);

      const size = await repository.calculateFolderSize(folder.uuid);

      expect(size).toBeGreaterThanOrEqual(0);
      expect(FolderModel.sequelize.query).toHaveBeenCalledWith(
        calculateSizeQuery,
        {
          replacements: {
            folderUuid: folder.uuid,
            fileStatusCondition: [FileStatus.EXISTS, FileStatus.TRASHED],
          },
        },
      );
    });

    it('When calculate folder size is requested without trashed files, then it should only request existent files', async () => {
      const folderModelSpy = jest.spyOn(FolderModel.sequelize, 'query');

      await repository.calculateFolderSize(folder.uuid, false);

      expect(folderModelSpy).toHaveBeenCalledWith(expect.any(String), {
        replacements: {
          folderUuid: folder.uuid,
          fileStatusCondition: [FileStatus.EXISTS],
        },
      });
    });

    it('When the folder size calculation times out, then throw an exception', async () => {
      jest.spyOn(FolderModel.sequelize, 'query').mockRejectedValue({
        original: {
          code: TIMEOUT_ERROR_CODE,
        },
      });

      await expect(repository.calculateFolderSize(folder.uuid)).rejects.toThrow(
        CalculateFolderSizeTimeoutException,
      );
    });
  });

  describe('findByParentUuid', () => {
    const parentId = 1;
    const plainNames = ['Document', 'Image'];

    it('When folders are searched with names, then it should handle the call with names', async () => {
      await repository.findByParent(parentId, {
        plainName: plainNames,
        deleted: false,
        removed: false,
      });

      expect(folderModel.findAll).toHaveBeenCalledWith({
        where: {
          parentId,
          plainName: { [Op.in]: plainNames },
          deleted: false,
          removed: false,
        },
      });
    });

    it('When called without specific criteria, then it should handle the call', async () => {
      await repository.findByParent(parentId, {
        plainName: [],
        deleted: false,
        removed: false,
      });

      expect(folderModel.findAll).toHaveBeenCalledWith({
        where: {
          parentId,
          deleted: false,
          removed: false,
        },
      });
    });
  });

  describe('findAllCursorInWorkspaceWhereUpdatedAfter', () => {
    const createdBy = 'user-uuid';
    const workspaceId = 'workspace-id';
    const updatedAfter = new Date('2023-01-01T00:00:00Z');
    const whereClause = { deleted: false, removed: false };
    const limit = 10;
    const offset = 0;
    const order: Array<[keyof FolderModel, 'ASC' | 'DESC']> = [
      ['updatedAt', 'ASC'],
    ];

    it('When no order is provided, it should default to nothing', async () => {
      jest.spyOn(folderModel, 'findAll');

      await repository.findAllCursorInWorkspaceWhereUpdatedAfter(
        createdBy,
        workspaceId,
        whereClause,
        updatedAfter,
        limit,
        offset,
      );

      expect(folderModel.findAll).toHaveBeenCalledWith({
        where: {
          ...whereClause,
          updatedAt: { [Op.gt]: updatedAfter },
          parentId: { [Op.not]: null },
        },
        include: [
          {
            model: WorkspaceItemUserModel,
            where: {
              createdBy,
              workspaceId,
              itemType: 'folder',
            },
          },
        ],
        order: [],
        limit,
        offset,
      });
    });

    it('When no folders are found, it should return nothing', async () => {
      jest.spyOn(folderModel, 'findAll').mockResolvedValueOnce([]);

      const result = await repository.findAllCursorInWorkspaceWhereUpdatedAfter(
        createdBy,
        workspaceId,
        whereClause,
        updatedAfter,
        limit,
        offset,
        order,
      );

      expect(result).toEqual([]);
    });
  });

  describe('findByUuidAndUser', () => {
    it('When folders are searched by uuid and user, then it should be handle as expected', async () => {
      const randomFolderUUID = v4();
      const randomUserId = randomInt(100000);
      const folder = newFolder();
      jest.spyOn(folderModel, 'findOne').mockReturnValueOnce(folder as any);

      await repository.findByUuidAndUser(randomFolderUUID, randomUserId);

      expect(folderModel.findOne).toHaveBeenCalledWith({
        where: {
          uuid: randomFolderUUID,
          userId: randomUserId,
          removed: false,
        },
      });
    });

    it('When folders are searched by uuid and user but they dont exist, then it should return null', async () => {
      const randomFolderUUID = v4();
      const randomUserId = randomInt(100000);
      jest.spyOn(folderModel, 'findOne').mockResolvedValueOnce(null);

      const result = await repository.findByUuidAndUser(
        randomFolderUUID,
        randomUserId,
      );

      expect(folderModel.findOne).toHaveBeenCalledWith({
        where: {
          uuid: randomFolderUUID,
          userId: randomUserId,
          removed: false,
        },
      });
      expect(result).toBeNull();
    });
  });

  describe('updateBy', () => {
    it('When folders are updated, it should update by the fields provided', async () => {
      const userId = 134455;
      jest.spyOn(folderModel, 'update').mockResolvedValueOnce([1]);

      await repository.updateBy({ removed: true }, { userId });

      expect(folderModel.update).toHaveBeenCalledWith(
        { removed: true },
        { where: { userId } },
      );
    });
  });

  describe('findAllCursorInWorkspace', () => {
    const createdBy = 'user-uuid';
    const workspaceId = 'workspace-id';
    const whereClause = { deleted: false, removed: false };
    const limit = 10;
    const offset = 0;
    const order: Array<[keyof FolderModel, 'ASC' | 'DESC']> = [
      ['updatedAt', 'ASC'],
    ];

    it('When folders are found in workspace, then they should be returned', async () => {
      const folder1 = newFolder();
      const folder2 = newFolder();
      jest
        .spyOn(folderModel, 'findAll')
        .mockResolvedValueOnce([folder1, folder2] as any);

      const result = await repository.findAllCursorInWorkspace(
        createdBy,
        workspaceId,
        whereClause,
        limit,
        offset,
        order,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Folder);
      expect(result[1]).toBeInstanceOf(Folder);
      expect(folderModel.findAll).toHaveBeenCalledWith({
        include: [
          {
            model: WorkspaceItemUserModel,
            where: {
              createdBy,
              workspaceId,
              itemType: WorkspaceItemType.Folder,
            },
            as: 'workspaceUser',
            include: [
              {
                model: UserModel,
                as: 'creator',
                attributes: ['uuid', 'email', 'name', 'lastname', 'userId'],
              },
            ],
          },
          {
            separate: true,
            model: SharingModel,
            attributes: ['type', 'id'],
            required: false,
          },
        ],
        limit,
        offset,
        where: whereClause,
        subQuery: false,
        order,
      });
    });

    it('When no folders are found in workspace, then empty array should be returned', async () => {
      jest.spyOn(folderModel, 'findAll').mockResolvedValueOnce([]);

      const result = await repository.findAllCursorInWorkspace(
        createdBy,
        workspaceId,
        whereClause,
        limit,
        offset,
        order,
      );

      expect(result).toEqual([]);
    });
  });

  describe('createWithAttributes', () => {
    it('When creating a folder with attributes, then it should return the created folder', async () => {
      const folderAttributes = {
        uuid: v4(),
        userId: 1,
        name: 'encrypted-name',
        plainName: 'Test Folder',
        bucket: 'bucket-id',
        parentId: null,
        parentUuid: null,
        encryptVersion: '03-aes' as const,
        deleted: false,
        removed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        removedAt: null,
        creationTime: new Date(),
        modificationTime: new Date(),
      };

      jest.spyOn(folderModel, 'create').mockResolvedValueOnce({
        toJSON: jest.fn().mockReturnValue(folderAttributes),
      } as any);

      const result = await repository.createWithAttributes(folderAttributes);

      expect(folderModel.create).toHaveBeenCalledWith(folderAttributes);
      expect(result).toBeInstanceOf(Folder);
    });
  });

  describe('findByUuid', () => {
    const folderUuid = v4();

    it('When folder is found by uuid, then it should return the folder', async () => {
      const folder = newFolder({ attributes: { uuid: folderUuid } });
      jest.spyOn(folderModel, 'findOne').mockResolvedValueOnce(folder as any);

      const result = await repository.findByUuid(folderUuid);

      expect(folderModel.findOne).toHaveBeenCalledWith({
        where: { uuid: folderUuid, deleted: false, removed: false },
      });
      expect(result).toBeInstanceOf(Folder);
      expect(result.uuid).toBe(folderUuid);
    });

    it('When folder is not found by uuid, then it should return null', async () => {
      jest.spyOn(folderModel, 'findOne').mockResolvedValueOnce(null);

      const result = await repository.findByUuid(folderUuid);

      expect(result).toBeNull();
    });

    it('When searching for deleted folder, then it should include deleted condition', async () => {
      const deletedFolder = newFolder({
        attributes: { uuid: folderUuid, deleted: true },
      });
      jest
        .spyOn(folderModel, 'findOne')
        .mockResolvedValueOnce(deletedFolder as any);

      const result = await repository.findByUuid(folderUuid, true);

      expect(folderModel.findOne).toHaveBeenCalledWith({
        where: { uuid: folderUuid, deleted: true, removed: false },
      });
      expect(result).toBeInstanceOf(Folder);
      expect(result.uuid).toBe(folderUuid);
    });
  });

  describe('findOne', () => {
    it('When folder is found with where conditions, then it should return the folder', async () => {
      const whereConditions = { userId: 1, parentId: null };
      const folder = newFolder({ attributes: whereConditions });
      jest.spyOn(folderModel, 'findOne').mockResolvedValueOnce(folder as any);

      const result = await repository.findOne(whereConditions);

      expect(folderModel.findOne).toHaveBeenCalledWith({
        where: whereConditions,
      });
      expect(result).toBeInstanceOf(Folder);
      expect(result.userId).toBe(1);
    });

    it('When no folder is found with where conditions, then it should return null', async () => {
      const whereConditions = { userId: 999, plainName: 'NonExistent' };
      jest.spyOn(folderModel, 'findOne').mockResolvedValueOnce(null);

      const result = await repository.findOne(whereConditions);

      expect(result).toBeNull();
    });
  });

  describe('deleteById', () => {
    it('When deleting a folder by id, then it should call destroy', async () => {
      const folderId = 123;
      jest.spyOn(folderModel, 'destroy').mockResolvedValueOnce(1);

      await repository.deleteById(folderId);

      expect(folderModel.destroy).toHaveBeenCalledWith({
        where: { id: { [Op.eq]: folderId } },
      });
    });
  });

  describe('clearOrphansFolders', () => {
    it('When clearing orphan folders, then it should return the number of deleted folders', async () => {
      const userId = 1;
      const mockResult = [[{ total_left: 5 }]];
      jest
        .spyOn(folderModel.sequelize, 'query')
        .mockResolvedValueOnce(mockResult as any);

      const result = await repository.clearOrphansFolders(userId);

      expect(folderModel.sequelize.query).toHaveBeenCalledWith(
        'CALL clear_orphan_folders_by_user (:userId, :output)',
        {
          replacements: { userId, output: null },
        },
      );
      expect(result).toBe(5);
    });
  });

  describe('findAllByParentUuid', () => {
    const parentUuid = v4();

    it('When folders are found by parent uuid, then they should be returned', async () => {
      const folder1 = newFolder({ attributes: { parentUuid } });
      const folder2 = newFolder({ attributes: { parentUuid } });
      jest
        .spyOn(folderModel, 'findAll')
        .mockResolvedValueOnce([folder1, folder2] as any);

      const result = await repository.findAllByParentUuid(parentUuid);

      expect(folderModel.findAll).toHaveBeenCalledWith({
        where: { parentUuid, deleted: false },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Folder);
      expect(result[1]).toBeInstanceOf(Folder);
    });

    it('When searching for deleted folders by parent uuid, then deleted condition should be applied', async () => {
      jest.spyOn(folderModel, 'findAll').mockResolvedValueOnce([]);

      await repository.findAllByParentUuid(parentUuid, true);

      expect(folderModel.findAll).toHaveBeenCalledWith({
        where: { parentUuid, deleted: true },
      });
    });
  });

  describe('updateManyByFolderId', () => {
    it('When updating multiple folders by ids, then it should call update with correct conditions', async () => {
      const folderIds = [1, 2, 3];
      const updateData = { deleted: true, deletedAt: new Date() };
      jest.spyOn(folderModel, 'update').mockResolvedValueOnce([3] as any);

      await repository.updateManyByFolderId(folderIds, updateData);

      expect(folderModel.update).toHaveBeenCalledWith(updateData, {
        where: { id: { [Op.in]: folderIds } },
      });
    });
  });

  describe('findUserFoldersByUuid', () => {
    it('When finding user folders by uuids, then it should return matching folders', async () => {
      const user = newUser();
      const folderUuids = [v4(), v4()];
      const folders = [
        newFolder({ attributes: { uuid: folderUuids[0], userId: user.id } }),
        newFolder({ attributes: { uuid: folderUuids[1], userId: user.id } }),
      ];
      jest.spyOn(folderModel, 'findAll').mockResolvedValueOnce(folders as any);

      const result = await repository.findUserFoldersByUuid(user, folderUuids);

      expect(folderModel.findAll).toHaveBeenCalledWith({
        where: {
          uuid: { [Op.in]: folderUuids },
          userId: user.id,
          deleted: false,
          removed: false,
        },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Folder);
      expect(result[1]).toBeInstanceOf(Folder);
    });

    it('When no folders are found for user and uuids, then empty array should be returned', async () => {
      const user = newUser();
      const folderUuids = [v4()];
      jest.spyOn(folderModel, 'findAll').mockResolvedValueOnce([]);

      const result = await repository.findUserFoldersByUuid(user, folderUuids);

      expect(result).toEqual([]);
    });
  });

  describe('findAllCursor', () => {
    const whereClause = { deleted: false, removed: false };
    const limit = 10;
    const offset = 0;
    const order: Array<[keyof FolderModel, 'ASC' | 'DESC']> = [['name', 'ASC']];

    it('When finding folders with cursor pagination, then it should return folders', async () => {
      const folders = [newFolder(), newFolder()];
      jest.spyOn(folderModel, 'findAll').mockResolvedValueOnce(folders as any);

      const result = await repository.findAllCursor(
        whereClause,
        limit,
        offset,
        order,
      );

      expect(folderModel.findAll).toHaveBeenCalledWith({
        limit,
        offset,
        where: whereClause,
        subQuery: false,
        order,
        include: [
          {
            separate: true,
            model: SharingModel,
            attributes: ['type', 'id'],
            required: false,
          },
        ],
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Folder);
    });
  });

  describe('findAllCursorWithParent', () => {
    const whereClause = { deleted: false };
    const limit = 10;
    const offset = 0;
    const order: Array<[keyof FolderModel, 'ASC' | 'DESC']> = [['name', 'ASC']];

    it('When finding folders with parent information, then it should include parent data', async () => {
      const folders = [newFolder(), newFolder()];
      jest.spyOn(folderModel, 'findAll').mockResolvedValueOnce(folders as any);

      const result = await repository.findAllCursorWithParent(
        whereClause,
        limit,
        offset,
        order,
      );

      expect(folderModel.findAll).toHaveBeenCalledWith({
        include: [
          {
            model: FolderModel,
            as: 'parent',
            attributes: ['id', 'uuid'],
            where: {
              deleted: false,
              removed: false,
            },
          },
        ],
        limit,
        offset,
        where: whereClause,
        order,
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('findByIds', () => {
    it('When finding folders by ids for a user, then it should return matching folders', async () => {
      const user = newUser();
      const folderIds = [1, 2, 3];
      const folders = [
        newFolder({ attributes: { id: 1, userId: user.id } }),
        newFolder({ attributes: { id: 2, userId: user.id } }),
      ];
      jest.spyOn(folderModel, 'findAll').mockResolvedValueOnce(folders as any);

      const result = await repository.findByIds(user, folderIds);

      expect(folderModel.findAll).toHaveBeenCalledWith({
        where: { id: { [Op.in]: folderIds }, userId: user.id },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('findByUuids', () => {
    it('When finding folders by uuids, then it should return matching folders', async () => {
      const folderUuids = [v4(), v4()];
      const folders = [
        newFolder({ attributes: { uuid: folderUuids[0] } }),
        newFolder({ attributes: { uuid: folderUuids[1] } }),
      ];
      jest.spyOn(folderModel, 'findAll').mockResolvedValueOnce(folders as any);

      const result = await repository.findByUuids(folderUuids);

      expect(folderModel.findAll).toHaveBeenCalledWith({
        where: { uuid: { [Op.in]: folderUuids } },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('findAllByParentIdCursor', () => {
    it('When finding folders by parent id with cursor, then it should return ordered folders', async () => {
      const whereClause = { parentId: 1, deleted: false };
      const limit = 10;
      const offset = 0;
      const folders = [newFolder()];
      jest.spyOn(folderModel, 'findAll').mockResolvedValueOnce(folders as any);

      const result = await repository.findAllByParentIdCursor(
        whereClause,
        limit,
        offset,
      );

      expect(folderModel.findAll).toHaveBeenCalledWith({
        limit,
        offset,
        where: whereClause,
        order: [['id', 'ASC']],
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findAllNotDeleted', () => {
    it('When finding non-deleted folders, then it should add removed condition', async () => {
      const whereClause = { userId: 1 };
      const limit = 10;
      const offset = 0;
      const folders = [newFolder()];
      jest.spyOn(folderModel, 'findAll').mockResolvedValueOnce(folders as any);

      const result = await repository.findAllNotDeleted(
        whereClause,
        limit,
        offset,
      );

      expect(folderModel.findAll).toHaveBeenCalledWith({
        limit,
        offset,
        where: {
          ...whereClause,
          removed: { [Op.eq]: false },
        },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findAllByParentId', () => {
    const parentId = 1;
    const deleted = false;

    it('When finding folders by parent id without pagination, then it should return all folders', async () => {
      const folders = [newFolder(), newFolder()];
      jest.spyOn(folderModel, 'findAll').mockResolvedValueOnce(folders as any);

      const result = await repository.findAllByParentId(parentId, deleted);

      expect(folderModel.findAll).toHaveBeenCalledWith({
        where: { parentId, deleted },
        order: [['id', 'ASC']],
      });
      expect(result).toHaveLength(2);
    });

    it('When finding folders by parent id with pagination, then it should apply limit and offset', async () => {
      const page = 1;
      const perPage = 5;
      const folders = [newFolder()];
      jest.spyOn(folderModel, 'findAll').mockResolvedValueOnce(folders as any);

      const result = await repository.findAllByParentId(
        parentId,
        deleted,
        page,
        perPage,
      );

      expect(folderModel.findAll).toHaveBeenCalledWith({
        where: { parentId, deleted },
        order: [['id', 'ASC']],
        offset: 5,
        limit: 5,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('When creating a folder with basic parameters, then it should return the created folder', async () => {
      const userId = 1;
      const name = 'folder-name';
      const bucket = 'bucket-id';
      const parentId = 2;
      const encryptVersion = '03-aes' as const;
      const parentUuid = v4();

      const createdFolder = newFolder({
        attributes: {
          userId,
          name,
          bucket,
          parentId,
          encryptVersion,
          parentUuid,
        },
      });
      jest
        .spyOn(folderModel, 'create')
        .mockResolvedValueOnce(createdFolder as any);

      const result = await repository.create(
        userId,
        name,
        name,
        bucket,
        parentId,
        encryptVersion,
        parentUuid,
      );

      expect(folderModel.create).toHaveBeenCalledWith({
        userId,
        name,
        plainName: name,
        bucket,
        parentId,
        encryptVersion,
        uuid: expect.any(String),
        parentUuid,
      });
      expect(result).toBeInstanceOf(Folder);
    });
  });

  describe('createFolder', () => {
    it('When creating a folder with partial data, then it should merge with userId', async () => {
      const userId = 1;
      const folderData = { name: 'test-folder', plainName: 'Test Folder' };
      const createdFolder = newFolder({
        attributes: { ...folderData, userId },
      });
      jest
        .spyOn(folderModel, 'create')
        .mockResolvedValueOnce(createdFolder as any);

      const result = await repository.createFolder(userId, folderData);

      expect(folderModel.create).toHaveBeenCalledWith({
        ...folderData,
        userId,
      });
      expect(result).toBeInstanceOf(Folder);
    });
  });

  describe('bulkCreate', () => {
    it('When bulk creating folders, then it should return array of created folders', async () => {
      const foldersData = [
        {
          userId: 1,
          name: 'folder1',
          plainName: 'folderPlainName1',
          bucket: 'bucket1',
          parentId: 1,
          encryptVersion: '03-aes' as const,
          parentUuid: v4(),
        },
        {
          userId: 1,
          name: 'folder2',
          plainName: 'folderPlainName2',
          bucket: 'bucket2',
          parentId: 1,
          encryptVersion: '03-aes' as const,
          parentUuid: v4(),
        },
      ];
      const createdFolders = foldersData.map((data) =>
        newFolder({ attributes: data }),
      );
      jest
        .spyOn(folderModel, 'bulkCreate')
        .mockResolvedValueOnce(createdFolders as any);

      const result = await repository.bulkCreate(foldersData);

      expect(folderModel.bulkCreate).toHaveBeenCalledWith(foldersData);
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Folder);
    });
  });

  describe('getFolderAncestors', () => {
    it('When getting folder ancestors, then it should call database function', async () => {
      const user = newUser();
      const folderUuid = v4();
      const mockAncestors = [{ id: 1, parent_id: null, plain_name: 'root' }];
      const builtFolders = [newFolder()];

      jest
        .spyOn(folderModel.sequelize, 'query')
        .mockResolvedValueOnce([mockAncestors] as any);
      jest
        .spyOn(folderModel, 'bulkBuild')
        .mockReturnValueOnce(builtFolders as any);

      const result = await repository.getFolderAncestors(user, folderUuid);

      expect(folderModel.sequelize.query).toHaveBeenCalledWith(
        'SELECT * FROM get_folder_ancestors(:folder_id, :user_id)',
        {
          replacements: { folder_id: folderUuid, user_id: user.id },
        },
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getFoldersCountWhere', () => {
    it('When counting folders with conditions, then it should return count', async () => {
      const whereConditions = { userId: 1, deleted: false };
      const mockCount = 5;
      jest.spyOn(folderModel, 'findAndCountAll').mockResolvedValueOnce({
        count: mockCount,
        rows: [],
      } as any);

      const result = await repository.getFoldersCountWhere(whereConditions);

      expect(folderModel.findAndCountAll).toHaveBeenCalledWith({
        where: whereConditions,
      });
      expect(result).toBe(mockCount);
    });
  });

  describe('getFoldersWhoseParentIdDoesNotExist', () => {
    it('When counting orphan folders, then it should return count of folders with non-existent parent', async () => {
      const userId = 1;
      const mockCount = 3;

      jest.spyOn(folderModel, 'findAndCountAll').mockResolvedValueOnce({
        count: mockCount,
        rows: [],
      } as any);

      const result =
        await repository.getFoldersWhoseParentIdDoesNotExist(userId);

      expect(folderModel.findAndCountAll).toHaveBeenCalledWith({
        where: {
          parentId: {
            [Op.not]: null,
            [Op.notIn]: expect.anything(),
          },
          userId,
        },
      });
      expect(result).toBe(mockCount);
    });
  });

  describe('deleteByUserAndUuids', () => {
    it('When deleting folders by user and uuids, then it should mark them as removed and deleted', async () => {
      const user = newUser();
      const folderUuids = [v4(), v4()];
      jest.spyOn(folderModel, 'update').mockResolvedValueOnce([2] as any);

      await repository.deleteByUserAndUuids(user, folderUuids);

      expect(folderModel.update).toHaveBeenCalledWith(
        {
          removed: true,
          removedAt: expect.any(Date),
          deleted: true,
          deletedAt: expect.any(Date),
        },
        {
          where: {
            userId: user.id,
            uuid: { [Op.in]: folderUuids },
          },
        },
      );
    });
  });

  describe('findAllCursorWhereUpdatedAfter', () => {
    it('When finding folders updated after a date, then it should apply date filter', async () => {
      const whereClause = { deleted: false };
      const updatedAfter = new Date('2023-01-01');
      const limit = 10;
      const offset = 0;
      const order: Array<[keyof FolderAttributes, string]> = [
        ['updatedAt', 'ASC'],
      ];
      const folders = [newFolder()];

      jest.spyOn(folderModel, 'findAll').mockResolvedValueOnce(folders as any);

      const result = await repository.findAllCursorWhereUpdatedAfter(
        whereClause,
        updatedAfter,
        limit,
        offset,
        order,
      );

      expect(folderModel.findAll).toHaveBeenCalledWith({
        where: {
          ...whereClause,
          updatedAt: { [Op.gt]: updatedAfter },
          parentId: { [Op.not]: null },
        },
        order,
        limit,
        offset,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getDeletedFoldersWithNotDeletedChildren', () => {
    const startDate = new Date('2023-01-01T00:00:00Z');
    const untilDate = new Date('2023-12-31T23:59:59Z');
    const limit = 100;

    it('When deleted folders with active children are requested without date filters, then it should not filter by date', async () => {
      await repository.getDeletedFoldersWithNotDeletedChildren({
        limit,
      });

      expect(folderModel.findAll).toHaveBeenCalledWith({
        attributes: ['uuid'],
        where: {
          removed: true,
          [Op.and]: expect.any(Object),
        },
        limit,
        raw: true,
      });
    });

    it('When deleted folders with active children are requested with dates, then it should apply date filters', async () => {
      await repository.getDeletedFoldersWithNotDeletedChildren({
        startDate,
        untilDate,
        limit,
      });

      expect(folderModel.findAll).toHaveBeenCalledWith({
        attributes: ['uuid'],
        where: {
          removed: true,
          updatedAt: {
            [Op.gte]: startDate,
            [Op.lt]: untilDate,
          },
          [Op.and]: expect.any(Object),
        },
        limit,
        raw: true,
      });
    });

    it('When no deleted folders with active children are found, then it should return empty array', async () => {
      jest.spyOn(folderModel, 'findAll').mockResolvedValueOnce([]);

      const result = await repository.getDeletedFoldersWithNotDeletedChildren({
        limit,
      });

      expect(result).toEqual([]);
    });
  });

  describe('getDeletedFoldersWithNotDeletedFiles', () => {
    const startDate = new Date('2023-01-01T00:00:00Z');
    const untilDate = new Date('2023-12-31T23:59:59Z');
    const limit = 100;

    it('When deleted folders with active files are requested without date filters, then it should return folder uuids', async () => {
      await repository.getDeletedFoldersWithNotDeletedFiles({
        limit,
      });

      expect(folderModel.findAll).toHaveBeenCalledWith({
        attributes: ['uuid'],
        where: {
          removed: true,
          [Op.and]: expect.any(Object),
        },
        limit,
        raw: true,
      });
    });

    it('When deleted folders with active files are requested with dates, then it should apply date filters', async () => {
      await repository.getDeletedFoldersWithNotDeletedFiles({
        startDate,
        untilDate,
        limit,
      });

      expect(folderModel.findAll).toHaveBeenCalledWith({
        attributes: ['uuid'],
        where: {
          removed: true,
          updatedAt: {
            [Op.gte]: startDate,
            [Op.lt]: untilDate,
          },
          [Op.and]: expect.any(Object),
        },
        limit,
        raw: true,
      });
    });
  });

  describe('markChildFoldersAsRemoved', () => {
    it('When child folders are marked as removed, then it should update folders with parent uuids', async () => {
      const parentUuids = [v4(), v4()];

      jest.useFakeTimers();
      const mockDate = new Date('2023-01-01T10:00:00Z');
      jest.setSystemTime(mockDate);

      await repository.markChildFoldersAsRemoved(parentUuids);

      expect(folderModel.update).toHaveBeenCalledWith(
        {
          removed: true,
          removedAt: mockDate,
          deleted: true,
          deletedAt: mockDate,
          updatedAt: mockDate,
        },
        {
          where: {
            parentUuid: { [Op.in]: parentUuids },
            removed: false,
          },
        },
      );

      jest.useRealTimers();
    });
  });

  describe('deleteTrashedFoldersBatch', () => {
    it('When deleting trashed folders in batch, then it should use correct SQL replacements', async () => {
      const userId = 12345;
      const limit = 100;
      const mockQueryResult: [unknown[], unknown] = [['test'], 5];

      jest
        .spyOn(folderModel.sequelize, 'query')
        .mockResolvedValueOnce(mockQueryResult);

      const result = await repository.deleteTrashedFoldersBatch(userId, limit);

      expect(folderModel.sequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE folders'),
        {
          replacements: { userId: userId, limit },
          type: QueryTypes.UPDATE,
        },
      );
      expect(result).toBe(5);
    });

    it('When deleting trashed folders with different parameters, then replacements should match input', async () => {
      const userId = 99999;
      const limit = 50;
      const mockQueryResult: [unknown[], unknown] = [[], 3];

      jest
        .spyOn(folderModel.sequelize, 'query')
        .mockResolvedValueOnce(mockQueryResult);

      await repository.deleteTrashedFoldersBatch(userId, limit);

      expect(folderModel.sequelize.query).toHaveBeenCalledWith(
        expect.any(String),
        {
          replacements: { userId: userId, limit },
          type: QueryTypes.UPDATE,
        },
      );
    });
  });

  describe('calculateFolderStats', () => {
    it('When folder is empty, then it should return zero for both count and size', async () => {
      const mockResult = {
        file_count: '0',
        total_size: '0',
        total_files_found: '0',
      };

      jest
        .spyOn(FolderModel.sequelize, 'query')
        .mockResolvedValueOnce([[mockResult]] as any);

      const result = await repository.calculateFolderStats(folder.uuid);

      expect(result.fileCount).toBe(0);
      expect(result.totalSize).toBe(0);
      expect(result.isFileCountExact).toBe(true);
      expect(result.isTotalSizeExact).toBe(true);
    });

    it('When folder has normal amount of files, then it should return exact count and size', async () => {
      const mockResult = {
        file_count: '500',
        total_size: '5000000',
        total_files_found: '500',
      };

      jest
        .spyOn(FolderModel.sequelize, 'query')
        .mockResolvedValueOnce([[mockResult]] as any);

      const result = await repository.calculateFolderStats(folder.uuid);

      expect(result.fileCount).toBe(500);
      expect(result.totalSize).toBe(5000000);
      expect(result.isFileCountExact).toBe(true);
      expect(result.isTotalSizeExact).toBe(true);
    });

    it('When folder reaches maximum file count, then it should return exact count at boundary', async () => {
      const mockResult = {
        file_count: '1000',
        total_size: '10000000',
        total_files_found: '1000',
      };

      jest
        .spyOn(FolderModel.sequelize, 'query')
        .mockResolvedValueOnce([[mockResult]] as any);

      const result = await repository.calculateFolderStats(folder.uuid);

      expect(result.fileCount).toBe(1000);
      expect(result.isFileCountExact).toBe(true);
    });

    it('When folder exceeds maximum file count, then it should cap count and mark as approximate', async () => {
      const mockResult = {
        file_count: '1500',
        total_size: '15000000',
        total_files_found: '1500',
      };

      jest
        .spyOn(FolderModel.sequelize, 'query')
        .mockResolvedValueOnce([[mockResult]] as any);

      const result = await repository.calculateFolderStats(folder.uuid);

      expect(result.fileCount).toBe(1000);
      expect(result.isFileCountExact).toBe(false);
    });

    it('When folder exceeds maximum total items, then it should mark size as approximate', async () => {
      const mockResult = {
        file_count: '12000',
        total_size: '50000000',
        total_files_found: '12000',
      };

      jest
        .spyOn(FolderModel.sequelize, 'query')
        .mockResolvedValueOnce([[mockResult]] as any);

      const result = await repository.calculateFolderStats(folder.uuid);

      expect(result.isTotalSizeExact).toBe(false);
      expect(result.isFileCountExact).toBe(false);
    });

    it('When folder has deep hierarchy, then it should include files from all nested levels', async () => {
      const mockResult = {
        file_count: '9973',
        total_size: '27634171904',
        total_files_found: '9973',
      };

      jest
        .spyOn(FolderModel.sequelize, 'query')
        .mockResolvedValueOnce([[mockResult]] as any);

      const result = await repository.calculateFolderStats(folder.uuid);

      expect(result.fileCount).toBe(1000);
      expect(result.totalSize).toBe(27634171904);
      expect(result.isFileCountExact).toBe(false);
      expect(result.isTotalSizeExact).toBe(true);
    });

    it('When stats calculation times out, then it should throw timeout exception', async () => {
      jest.spyOn(FolderModel.sequelize, 'query').mockRejectedValueOnce({
        original: {
          code: TIMEOUT_ERROR_CODE,
        },
      });

      await expect(
        repository.calculateFolderStats(folder.uuid),
      ).rejects.toThrow(CalculateFolderSizeTimeoutException);
    });

    it('When folder stats are requested, then only existent files are counted', async () => {
      const mockResult = {
        file_count: '100',
        total_size: '1000000',
        total_files_found: '100',
      };

      jest
        .spyOn(FolderModel.sequelize, 'query')
        .mockResolvedValueOnce([[mockResult]] as any);

      await repository.calculateFolderStats(folder.uuid);

      expect(FolderModel.sequelize.query).toHaveBeenCalledWith(
        expect.any(String),
        {
          replacements: {
            folderUuid: folder.uuid,
            fileStatusCondition: [FileStatus.EXISTS],
          },
        },
      );
    });
  });

  describe('deleteFoldersByUuid', () => {
    it('When folder UUIDs are provided, then it should mark them as removed', async () => {
      const folderUuids = [v4(), v4(), v4()];
      const updatedCount = 3;

      jest.spyOn(folderModel, 'update').mockResolvedValueOnce([updatedCount]);

      const result = await repository.deleteFoldersByUuid(folderUuids);

      expect(folderModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          removed: true,
        }),
        expect.objectContaining({
          where: {
            uuid: { [Op.in]: folderUuids },
            removed: false,
          },
        }),
      );
      expect(result).toBe(updatedCount);
    });

    it('When single folder UUID is provided, then it should process it', async () => {
      const folderUuid = v4();
      const updatedCount = 1;

      jest.spyOn(folderModel, 'update').mockResolvedValueOnce([updatedCount]);

      const result = await repository.deleteFoldersByUuid([folderUuid]);

      expect(folderModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          removed: true,
        }),
        expect.objectContaining({
          where: {
            uuid: { [Op.in]: [folderUuid] },
            removed: false,
          },
        }),
      );
      expect(result).toBe(1);
    });

    it('When no folders match the UUIDs, then it should return zero', async () => {
      const folderUuids = [v4(), v4()];
      const updatedCount = 0;

      jest.spyOn(folderModel, 'update').mockResolvedValueOnce([updatedCount]);

      const result = await repository.deleteFoldersByUuid(folderUuids);

      expect(result).toBe(0);
    });

    it('When folders already removed, then it should not update them', async () => {
      const folderUuids = [v4(), v4()];

      jest.spyOn(folderModel, 'update').mockResolvedValueOnce([0]);

      const result = await repository.deleteFoldersByUuid(folderUuids);

      expect(folderModel.update).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          where: expect.objectContaining({
            removed: false,
          }),
        }),
      );
      expect(result).toBe(0);
    });
  });
});
