import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { createMock } from '@golevelup/ts-jest';
import {
  newFile,
  newFolder,
  newUser,
  newWorkspace,
} from '../../../test/fixtures';
import { FileAttributes, FileStatus } from './file.domain';
import { FileModel } from './file.model';
import { FileRepository, SequelizeFileRepository } from './file.repository';
import { Op, QueryTypes, Sequelize } from 'sequelize';
import { v4 } from 'uuid';
import { UserModel } from '../user/user.model';
import { WorkspaceItemUserModel } from '../workspaces/models/workspace-items-users.model';

describe('FileRepository', () => {
  let repository: FileRepository;
  let fileModel: typeof FileModel;

  const user = newUser();
  const workspace = newWorkspace();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizeFileRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get<FileRepository>(SequelizeFileRepository);
    fileModel = module.get<typeof FileModel>(getModelToken(FileModel));
  });

  describe('getSumSizeOfFilesByStatuses', () => {
    it('When called with specific statuses and options, then it should fetch file sizes', async () => {
      const statuses = [FileStatus.EXISTS, FileStatus.TRASHED];
      const totalUsage = 100;
      const sizesSum = [{ total: totalUsage }];

      jest.spyOn(fileModel, 'findAll').mockResolvedValueOnce(sizesSum as any);

      const result = await repository.getSumSizeOfFilesInWorkspaceByStatuses(
        user.uuid,
        workspace.id,
        statuses,
      );

      expect(fileModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: expect.arrayContaining([
              { status: statuses[0] },
              { status: statuses[1] },
            ]),
          }),
          include: expect.objectContaining({
            where: expect.objectContaining({
              createdBy: user.uuid,
              workspaceId: workspace.id,
            }),
          }),
        }),
      );
      expect(result).toEqual(totalUsage);
    });

    it('When files removed from a specific date are fetch, then it should include the date in the query', async () => {
      const statuses = [FileStatus.DELETED];

      const totalUsage = 100;
      const sizesSum = [{ total: totalUsage }];

      jest.spyOn(fileModel, 'findAll').mockResolvedValueOnce(sizesSum as any);

      const result = await repository.getSumSizeOfFilesInWorkspaceByStatuses(
        user.uuid,
        workspace.id,
        statuses,
      );

      expect(fileModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: expect.arrayContaining([{ status: statuses[0] }]),
          }),
        }),
      );
      expect(result).toEqual(totalUsage);
    });
  });

  describe('findFilesInFolderByName', () => {
    const folderUuid = v4();

    it('When multiple files are searched, it should handle an array of search filters', async () => {
      const searchCriteria = [
        { plainName: 'Report', type: 'pdf' },
        { plainName: 'Summary', type: 'doc' },
      ];

      await repository.findFilesInFolderByName(folderUuid, searchCriteria);

      expect(fileModel.findAll).toHaveBeenCalledWith({
        where: expect.objectContaining({
          folderUuid,
          status: FileStatus.EXISTS,
          [Op.or]: [
            {
              plainName: 'Report',
              type: 'pdf',
            },
            {
              plainName: 'Summary',
              type: 'doc',
            },
          ],
        }),
      });
    });

    it('When a file is searched with only plainName, it should handle the missing type', async () => {
      const searchCriteria = [{ plainName: 'Report' }];

      await repository.findFilesInFolderByName(folderUuid, searchCriteria);

      expect(fileModel.findAll).toHaveBeenCalledWith({
        where: expect.objectContaining({
          folderUuid,
          status: FileStatus.EXISTS,
          [Op.or]: [
            {
              plainName: 'Report',
            },
          ],
        }),
      });
    });
  });

  describe('findByPlainNameAndFolderId', () => {
    it('When file is searched with empty type, it should find it', async () => {
      const mockFile = newFile({ attributes: { type: '' } });

      const model: FileModel = {
        ...mockFile,
        user: newUser(),
        folder: newFolder(),
        toJSON: mockFile.toJSON,
      } as any;

      jest.spyOn(fileModel, 'findOne').mockResolvedValueOnce(model);

      await repository.findByPlainNameAndFolderId(
        mockFile.userId,
        mockFile.plainName,
        mockFile.type,
        mockFile.folderId,
        mockFile.status,
      );

      expect(fileModel.findOne).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: { [Op.eq]: mockFile.userId },
          plainName: { [Op.eq]: mockFile.plainName },
          type: { [Op.or]: [{ [Op.is]: null }, { [Op.eq]: '' }] },
          folderId: { [Op.eq]: mockFile.folderId },
          status: { [Op.eq]: mockFile.status },
        }),
      });
    });

    it('When file is searched with null type, it should find it', async () => {
      const mockFile = newFile({ attributes: { type: null } });

      const model: FileModel = {
        ...mockFile,
        user: newUser(),
        folder: newFolder(),
        toJSON: mockFile.toJSON,
      } as any;

      jest.spyOn(fileModel, 'findOne').mockResolvedValueOnce(model);

      await repository.findByPlainNameAndFolderId(
        mockFile.userId,
        mockFile.plainName,
        mockFile.type,
        mockFile.folderId,
        mockFile.status,
      );

      expect(fileModel.findOne).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: { [Op.eq]: mockFile.userId },
          plainName: { [Op.eq]: mockFile.plainName },
          type: { [Op.or]: [{ [Op.is]: null }, { [Op.eq]: '' }] },
          folderId: { [Op.eq]: mockFile.folderId },
          status: { [Op.eq]: mockFile.status },
        }),
      });
    });

    it('When file is searched with type, it should find it', async () => {
      const mockFile = newFile();

      const model: FileModel = {
        ...mockFile,
        user: newUser(),
        folder: newFolder(),
        toJSON: mockFile.toJSON,
      } as any;

      jest.spyOn(fileModel, 'findOne').mockResolvedValueOnce(model);

      await repository.findByPlainNameAndFolderId(
        mockFile.userId,
        mockFile.plainName,
        mockFile.type,
        mockFile.folderId,
        mockFile.status,
      );

      expect(fileModel.findOne).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: { [Op.eq]: mockFile.userId },
          plainName: { [Op.eq]: mockFile.plainName },
          type: { [Op.eq]: mockFile.type },
          folderId: { [Op.eq]: mockFile.folderId },
          status: { [Op.eq]: mockFile.status },
        }),
      });
    });
  });

  describe('findAllCursorWhereUpdatedAfterInWorkspace', () => {
    const createdBy = v4();
    const workspaceId = v4();
    const updatedAtAfter = new Date();
    const limit = 10;
    const offset = 0;
    const additionalOrders = [['updatedAt', 'ASC']] as Array<
      [keyof FileModel, string]
    >;
    const whereClause: Partial<FileAttributes> = { status: FileStatus.EXISTS };

    it('When sort options are not provided, it should default to none', async () => {
      jest.spyOn(repository, 'findAllCursorInWorkspace');

      await repository.findAllCursorWhereUpdatedAfterInWorkspace(
        createdBy,
        workspaceId,
        whereClause,
        updatedAtAfter,
        limit,
        offset,
      );

      expect(repository.findAllCursorInWorkspace).toHaveBeenCalledWith(
        createdBy,
        workspaceId,
        {
          ...whereClause,
          updatedAt: { [Op.gt]: updatedAtAfter },
        },
        limit,
        offset,
        [],
      );
    });

    it('When sort options are provided, it should sort files', async () => {
      jest.spyOn(repository, 'findAllCursorInWorkspace');

      await repository.findAllCursorWhereUpdatedAfterInWorkspace(
        createdBy,
        workspaceId,
        whereClause,
        updatedAtAfter,
        limit,
        offset,
        additionalOrders,
      );

      expect(repository.findAllCursorInWorkspace).toHaveBeenCalledWith(
        createdBy,
        workspaceId,
        {
          ...whereClause,
          updatedAt: { [Op.gt]: updatedAtAfter },
        },
        limit,
        offset,
        additionalOrders,
      );
    });
  });

  describe('findAllCursorInWorkspace', () => {
    const createdBy = v4();
    const workspaceId = v4();
    const where = { status: FileStatus.TRASHED };
    const limit = 10;
    const offset = 0;
    const order: Array<[keyof FileModel, string]> = [['createdAt', 'DESC']];
    const mockFile = newFile();
    const toJson = {
      id: mockFile.id,
      uuid: mockFile.uuid,
      name: mockFile.name,
      folderId: mockFile.folderId,
      folderUuid: mockFile.folderUuid,
      userId: mockFile.userId,
      status: mockFile.status,
      plainName: mockFile.plainName,
      type: mockFile.type,
      deleted: false,
      removed: false,
    };
    const model: FileModel = {
      ...mockFile,
      user: { id: mockFile.userId, name: 'John Doe' },
      folder: { uuid: mockFile.folderId, plainName: mockFile.plainName },
      toJSON: () => ({ ...toJson }),
    } as any;

    it('when called with valid parameters then returns mapped files', async () => {
      jest.spyOn(fileModel, 'findAll').mockResolvedValue([model]);

      const result = await repository.findAllCursorInWorkspace(
        createdBy,
        workspaceId,
        where,
        limit,
        offset,
        order,
      );

      expect(fileModel.findAll).toHaveBeenCalledWith({
        limit,
        offset,
        where,
        include: expect.any(Array),
        subQuery: false,
        order: expect.any(Array),
      });
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...toJson,
            folder: expect.objectContaining({ ...model.folder }),
            user: expect.objectContaining({ ...model.user }),
          }),
        ]),
      );
    });

    it('when no files found then returns empty array', async () => {
      jest.spyOn(fileModel, 'findAll').mockResolvedValue([]);
      const result = await repository.findAllCursorInWorkspace(
        createdBy,
        workspaceId,
        where,
        limit,
        offset,
        order,
      );

      expect(result).toEqual([]);
    });
  });

  describe('findAllCursorWithThumbnailsInWorkspace', () => {
    const createdBy = v4();
    const workspaceId = v4();
    const where = { status: FileStatus.TRASHED };
    const limit = 10;
    const offset = 0;
    const order: Array<[keyof FileModel, string]> = [['createdAt', 'DESC']];
    const mockFile = newFile();
    const toJson = {
      id: mockFile.id,
      uuid: mockFile.uuid,
      name: mockFile.name,
      folderId: mockFile.folderId,
      folderUuid: mockFile.folderUuid,
      userId: mockFile.userId,
      status: mockFile.status,
      plainName: mockFile.plainName,
      type: mockFile.type,
      deleted: false,
      removed: false,
    };
    const model: FileModel = {
      ...mockFile,
      user: { id: mockFile.userId, name: 'John Doe' },
      folder: { uuid: mockFile.folderId, plainName: mockFile.plainName },
      toJSON: () => ({ ...toJson }),
    } as any;

    it('when called with valid parameters then returns mapped files with thumbnails', async () => {
      jest.spyOn(fileModel, 'findAll').mockResolvedValue([model]);

      const result = await repository.findAllCursorWithThumbnailsInWorkspace(
        createdBy,
        workspaceId,
        where,
        limit,
        offset,
        order,
      );

      expect(fileModel.findAll).toHaveBeenCalledWith({
        limit,
        offset,
        where,
        include: expect.any(Array),
        subQuery: false,
        order: expect.any(Array),
      });
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...toJson,
            folder: expect.objectContaining({ ...model.folder }),
            user: expect.objectContaining({ ...model.user }),
          }),
        ]),
      );
    });

    it('when no files found then returns empty array', async () => {
      jest.spyOn(fileModel, 'findAll').mockResolvedValue([]);

      const result = await repository.findAllCursorWithThumbnailsInWorkspace(
        createdBy,
        workspaceId,
        where,
        limit,
        offset,
        order,
      );

      expect(result).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('When files are found then it should return an array of files', async () => {
      const file1 = v4();
      const file2 = v4();
      const mockFiles = [
        {
          id: file1,
          name: 'file1',
          plainName: 'plainName_file1',
          toJSON: () => ({
            id: file1,
            name: 'file1',
            plainName: 'plainName_file1',
          }),
        },
        {
          id: file2,
          name: 'file2',
          plainName: 'plainName_file2',
          toJSON: () => ({
            id: file2,
            name: 'file1',
            plainName: 'plainName_file2',
          }),
        },
      ] as unknown as FileModel[];
      jest.spyOn(fileModel, 'findAll').mockResolvedValue(mockFiles);

      const result = await repository.findAll();

      expect(fileModel.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            plainName: expect.any(String),
          }),
        ]),
      );
    });

    it('When no files are found then it should return an empty array', async () => {
      jest.spyOn(fileModel, 'findAll').mockResolvedValue([]);
      const result = await repository.findAll();
      expect(fileModel.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('When creation is successful then it should return a file', async () => {
      const fileUuid = v4();
      const fileData = {
        name: 'file1',
        plainName: 'plainName_file1',
      } as any;
      const fileDataWithId = { ...fileData, id: fileUuid };

      jest.spyOn(fileModel, 'create').mockResolvedValue({
        fileDataWithId,
        toJSON: () => fileDataWithId,
      });

      const result = await repository.create(fileData);

      expect(fileModel.create).toHaveBeenCalledWith(fileData);
      expect(result).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          plainName: expect.any(String),
        }),
      );
    });

    it('When creation fails then it should return null', async () => {
      const fileData = { name: v4() } as any;
      jest.spyOn(fileModel, 'create').mockResolvedValue(null);
      const result = await repository.create(fileData);

      expect(result).toBeNull();
      expect(fileModel.create).toHaveBeenCalledWith(fileData);
    });
  });

  describe('findByFileIds', () => {
    const userId = 1;
    const fileIds = [v4(), v4()];
    it('When files are found then it should return an array of files', async () => {
      const mockFiles = [
        {
          id: fileIds[0],
          name: 'file1',
          plainName: 'plainName_file1',
          toJSON: () => ({
            id: fileIds[0],
            name: 'file1',
            plainName: 'plainName_file1',
          }),
        },
        {
          id: fileIds[1],
          name: 'file2',
          plainName: 'plainName_file2',
          toJSON: () => ({
            id: fileIds[1],
            name: 'file1',
            plainName: 'plainName_file2',
          }),
        },
      ] as any;
      jest.spyOn(fileModel, 'findAll').mockResolvedValue(mockFiles);

      const result = await repository.findByFileIds(userId, fileIds);

      expect(fileModel.findAll).toHaveBeenCalledWith({
        where: {
          userId: userId,
          fileId: {
            [Op.in]: fileIds,
          },
        },
      });
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
          }),
        ]),
      );
    });

    it('When no files are found then it should return an empty array', async () => {
      jest.spyOn(fileModel, 'findAll').mockResolvedValue([]);

      const result = await repository.findByFileIds(userId, fileIds);

      expect(result).toEqual([]);
      expect(fileModel.findAll).toHaveBeenCalledWith({
        where: {
          userId: userId,
          fileId: {
            [Op.in]: fileIds,
          },
        },
      });
    });
  });

  describe('sumExistentFileSizes', () => {
    const userId = 123;

    it('When called with valid userId, then it should return the sum of file sizes that are not deleted', async () => {
      const totalSize = 5000;
      const sizesSum = [{ total: totalSize }];

      jest.spyOn(fileModel, 'findAll').mockResolvedValueOnce(sizesSum as any);

      const result = await repository.sumExistentFileSizes(userId);

      expect(fileModel.findAll).toHaveBeenCalledWith({
        attributes: [[Sequelize.fn(`SUM`, Sequelize.col('size')), 'total']],
        where: {
          userId,
          status: {
            [Op.ne]: 'DELETED',
          },
        },
        raw: true,
      });
      expect(result).toEqual(totalSize);
    });

    it('When no files are found or total size is null, then it should return 0', async () => {
      const sizesSum = [{ total: null }];

      jest.spyOn(fileModel, 'findAll').mockResolvedValueOnce(sizesSum as any);

      const result = await repository.sumExistentFileSizes(userId);

      expect(fileModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId,
            status: {
              [Op.ne]: 'DELETED',
            },
          },
        }),
      );
      expect(result).toEqual(0);
    });
  });

  describe('deleteFilesByUser ', () => {
    it('When files are deleted successfully, then it should call update with correct parameters', async () => {
      const user = newUser();
      const files = [{ id: 123456 }, { id: 654321 }] as any;

      await repository.deleteFilesByUser(user, files);

      expect(fileModel.update).toHaveBeenCalledWith(
        {
          removed: true,
          removedAt: expect.any(Date),
          status: expect.any(String),
          updatedAt: expect.any(Date),
        },
        {
          where: {
            userId: user.id,
            uuid: {
              [Op.in]: files.map(({ uuid }) => uuid),
            },
          },
        },
      );
    });

    it('When an error occurs during the update, then it should throw an error', async () => {
      const user = newUser();
      const files = [{ id: 123456 }, { id: 654321 }] as any;

      jest
        .spyOn(fileModel, 'update')
        .mockRejectedValue(new Error('Update failed'));

      await expect(repository.deleteFilesByUser(user, files)).rejects.toThrow(
        'Update failed',
      );
    });
  });

  describe('destroyFile', () => {
    it('When destroyFile is called, then it should call destroy with correct parameters', async () => {
      const where = { id: 1234567 };

      await repository.destroyFile(where);

      expect(fileModel.destroy).toHaveBeenCalledWith({ where });
    });

    it('When an error occurs during the destroy, then it should throw an error', async () => {
      const where = { id: 1234567 };

      jest
        .spyOn(fileModel, 'destroy')
        .mockRejectedValue(new Error('Destroy failed'));

      await expect(repository.destroyFile(where)).rejects.toThrow(
        'Destroy failed',
      );
    });
  });

  describe('getFilesWithUserByUuuid', () => {
    it('When called, then it should call the model with the expected parameters', async () => {
      const file1 = newFile();
      const file2 = newFile();
      const fileUuids = [file1.uuid, file2.uuid];
      const mockFiles = [
        {
          ...file1.toJSON(),
          user: newUser(),
        },
        {
          ...file2.toJSON(),
          user: newUser(),
        },
      ];

      jest.spyOn(fileModel, 'findAll').mockResolvedValueOnce(mockFiles as any);
      jest
        .spyOn(repository as any, 'toDomain')
        .mockReturnValueOnce(file1)
        .mockReturnValueOnce(file2);
      jest
        .spyOn(repository as any, 'applyCollateToPlainNameSort')
        .mockReturnValue(null);

      await repository.getFilesWithUserByUuuid(fileUuids);

      expect(fileModel.findAll).toHaveBeenCalledWith({
        where: {
          uuid: { [Op.in]: fileUuids },
        },
        include: [
          {
            model: UserModel,
            as: 'user',
            attributes: [
              'uuid',
              'email',
              'name',
              'lastname',
              'avatar',
              'userId',
              'bridgeUser',
            ],
          },
        ],
        order: null,
      });
    });
  });

  describe('deleteUserTrashedFilesBatch', () => {
    it('When deleting trashed files in batch, then it should use correct SQL replacements', async () => {
      const userId = 12345;
      const limit = 100;
      const mockQueryResult: [unknown[], unknown] = [[], 5];

      jest
        .spyOn(fileModel.sequelize, 'query')
        .mockResolvedValueOnce(mockQueryResult);

      const result = await repository.deleteUserTrashedFilesBatch(
        userId,
        limit,
      );

      expect(fileModel.sequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE files'),
        {
          replacements: {
            userId: userId,
            limit,
            deletedStatus: FileStatus.DELETED,
            trashedStatus: FileStatus.TRASHED,
          },
          type: QueryTypes.UPDATE,
        },
      );
      expect(result).toBe(5);
    });

    it('When deleting trashed files with different parameters, then replacements should match input', async () => {
      const userId = 99999;
      const limit = 50;
      const mockQueryResult: [unknown[], unknown] = [[], 3];

      jest
        .spyOn(fileModel.sequelize, 'query')
        .mockResolvedValueOnce(mockQueryResult);

      await repository.deleteUserTrashedFilesBatch(userId, limit);

      expect(fileModel.sequelize.query).toHaveBeenCalledWith(
        expect.any(String),
        {
          replacements: {
            userId: userId,
            limit,
            deletedStatus: FileStatus.DELETED,
            trashedStatus: FileStatus.TRASHED,
          },
          type: QueryTypes.UPDATE,
        },
      );
    });
  });

  describe('getFilesWithWorkspaceUser', () => {
    it('When called, then it should make the query with expected parameters', async () => {
      const file1 = newFile();
      const file2 = newFile();
      const fileUuids = [file1.uuid, file2.uuid];

      jest.spyOn(fileModel, 'findAll').mockResolvedValueOnce([]);
      jest
        .spyOn(repository as any, 'toDomain')
        .mockReturnValueOnce(file1)
        .mockReturnValueOnce(file2);
      jest
        .spyOn(repository as any, 'applyCollateToPlainNameSort')
        .mockReturnValue(null);

      await repository.getFilesWithWorkspaceUser(fileUuids);

      expect(fileModel.findAll).toHaveBeenCalledWith({
        where: {
          uuid: { [Op.in]: fileUuids },
          status: FileStatus.EXISTS,
        },
        include: [
          {
            model: WorkspaceItemUserModel,
            as: 'workspaceUser',
            include: [
              {
                model: UserModel,
                as: 'creator',
                attributes: ['uuid', 'email', 'name', 'lastname', 'avatar'],
              },
            ],
          },
        ],
        order: null,
      });
    });
  });

  describe('sumFileSizeDeltaBetweenDates', () => {
    const userId = 123;
    const sinceDate = new Date('2024-01-01');
    const untilDate = new Date('2024-01-31');

    it('When files have size delta, then it should return the total delta', async () => {
      const totalDelta = 1500;
      const result = [{ total: totalDelta }];

      jest.spyOn(fileModel, 'findAll').mockResolvedValueOnce(result as any);

      const response = await repository.sumFileSizeDeltaBetweenDates(
        userId,
        sinceDate,
        untilDate,
      );

      expect(fileModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
          }),
          bind: {
            sinceDate,
            untilDate,
          },
          raw: true,
        }),
      );
      expect(response).toBe(totalDelta);
    });

    it('When no files are found or total is null, then it should return 0', async () => {
      const result = [{ total: null }];

      jest.spyOn(fileModel, 'findAll').mockResolvedValueOnce(result as any);

      const response = await repository.sumFileSizeDeltaBetweenDates(
        userId,
        sinceDate,
        untilDate,
      );

      expect(response).toBe(0);
    });
  });

  describe('findAllCursorWithVersions', () => {
    const userId = 1;
    const limit = 10;
    const offset = 0;
    const order: Array<[keyof FileModel, string]> = [['createdAt', 'DESC']];

    beforeEach(() => {
      const mockSequelize = {
        getQueryInterface: jest.fn(() => ({
          queryGenerator: {
            quoteIdentifier: jest.fn((identifier: string) => `"${identifier}"`),
          },
        })),
        query: jest.fn(),
      };

      Object.defineProperty(fileModel, 'sequelize', {
        value: mockSequelize,
        writable: true,
        configurable: true,
      });

      fileModel.getAttributes = jest.fn(() => ({
        id: { field: 'id' },
        uuid: { field: 'uuid' },
        fileId: { field: 'file_id' },
        userId: { field: 'user_id' },
        size: { field: 'size' },
        status: { field: 'status' },
        createdAt: { field: 'created_at' },
      })) as any;
    });

    it('When file has versions, then it should return fileId from latest version and size as sum of all versions', async () => {
      const mockResults = [
        {
          id: 1,
          uuid: 'file-uuid-1',
          fileId: 'version_file-uuid-1_5',
          userId: 1,
          size: '150000000',
          status: 'EXISTS',
          createdAt: new Date('2024-01-15'),
        },
      ];

      jest
        .spyOn(fileModel.sequelize, 'query')
        .mockResolvedValueOnce(mockResults as any);

      const result = await repository.findAllCursorWithVersions(
        { userId, status: 'EXISTS' },
        limit,
        offset,
        order,
        { withThumbnails: false, withSharings: false },
      );

      expect(fileModel.sequelize.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'COALESCE(latest_version.network_file_id, pf.file_id) as "fileId"',
        ),
        expect.objectContaining({
          replacements: expect.objectContaining({
            limit,
            offset,
          }),
          type: QueryTypes.SELECT,
          raw: true,
        }),
      );

      expect(fileModel.sequelize.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'COALESCE(latest_version.total_size, pf.size) as "size"',
        ),
        expect.any(Object),
      );

      expect(result).toHaveLength(1);
      expect(result[0].fileId).toBe('version_file-uuid-1_5');
      expect(result[0].size).toBe('150000000');
    });

    it('When file has no versions, then it should return original fileId and size from files table', async () => {
      const mockResults = [
        {
          id: 2,
          uuid: 'file-uuid-2',
          fileId: 'original_file_id',
          userId: 1,
          size: '50000000',
          status: 'EXISTS',
          createdAt: new Date('2024-01-10'),
        },
      ];

      jest
        .spyOn(fileModel.sequelize, 'query')
        .mockResolvedValueOnce(mockResults as any);

      const result = await repository.findAllCursorWithVersions(
        { userId, status: 'EXISTS' },
        limit,
        offset,
        order,
        { withThumbnails: false, withSharings: false },
      );

      expect(result).toHaveLength(1);
      expect(result[0].fileId).toBe('original_file_id');
      expect(result[0].size).toBe('50000000');
    });

    it('When withThumbnails is true, then it should include thumbnails in the query', async () => {
      const mockResults = [
        {
          id: 1,
          uuid: 'file-uuid-1',
          fileId: 'version_file-uuid-1_5',
          userId: 1,
          size: '150000000',
          status: 'EXISTS',
          createdAt: new Date('2024-01-15'),
          thumbnails: [{ id: 1, type: 'png', size: 1024 }],
        },
      ];

      jest
        .spyOn(fileModel.sequelize, 'query')
        .mockResolvedValueOnce(mockResults as any);

      const result = await repository.findAllCursorWithVersions(
        { userId, status: 'EXISTS' },
        limit,
        offset,
        order,
        { withThumbnails: true, withSharings: false },
      );

      expect(fileModel.sequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('thumbnails_agg.thumbnails'),
        expect.any(Object),
      );

      expect(result).toHaveLength(1);
      expect(result[0].thumbnails).toBeDefined();
    });

    it('When withSharings is true, then it should include sharings in the query', async () => {
      const mockResults = [
        {
          id: 1,
          uuid: 'file-uuid-1',
          fileId: 'version_file-uuid-1_5',
          userId: 1,
          size: '150000000',
          status: 'EXISTS',
          createdAt: new Date('2024-01-15'),
          sharings: [{ id: 1, type: 'public' }],
        },
      ];

      jest
        .spyOn(fileModel.sequelize, 'query')
        .mockResolvedValueOnce(mockResults as any);

      const result = await repository.findAllCursorWithVersions(
        { userId, status: 'EXISTS' },
        limit,
        offset,
        order,
        { withThumbnails: false, withSharings: true },
      );

      expect(fileModel.sequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('sharings_agg.sharings'),
        expect.any(Object),
      );

      expect(result).toHaveLength(1);
      expect(result[0].sharings).toBeDefined();
    });

    it('When multiple files are returned, then all should have correct fileId and size', async () => {
      const mockResults = [
        {
          id: 1,
          uuid: 'file-uuid-1',
          fileId: 'version_file-uuid-1_5',
          userId: 1,
          size: '150000000',
          status: 'EXISTS',
          createdAt: new Date('2024-01-15'),
        },
        {
          id: 2,
          uuid: 'file-uuid-2',
          fileId: 'original_file_id_2',
          userId: 1,
          size: '50000000',
          status: 'EXISTS',
          createdAt: new Date('2024-01-10'),
        },
        {
          id: 3,
          uuid: 'file-uuid-3',
          fileId: 'version_file-uuid-3_2',
          userId: 1,
          size: '200000000',
          status: 'EXISTS',
          createdAt: new Date('2024-01-05'),
        },
      ];

      jest
        .spyOn(fileModel.sequelize, 'query')
        .mockResolvedValueOnce(mockResults as any);

      const result = await repository.findAllCursorWithVersions(
        { userId, status: 'EXISTS' },
        limit,
        offset,
        order,
        { withThumbnails: false, withSharings: false },
      );

      expect(result).toHaveLength(3);
      expect(result[0].fileId).toBe('version_file-uuid-1_5');
      expect(result[0].size).toBe('150000000');
      expect(result[1].fileId).toBe('original_file_id_2');
      expect(result[1].size).toBe('50000000');
      expect(result[2].fileId).toBe('version_file-uuid-3_2');
      expect(result[2].size).toBe('200000000');
    });
  });

  describe('buildWhereClause (private method)', () => {
    let mockSequelize: any;
    let mockQueryGen: any;

    beforeEach(() => {
      mockQueryGen = {
        quoteIdentifier: jest.fn((identifier: string) => `"${identifier}"`),
      };

      mockSequelize = {
        getQueryInterface: jest.fn(() => ({
          queryGenerator: mockQueryGen,
        })),
      };

      Object.defineProperty(fileModel, 'sequelize', {
        value: mockSequelize,
        writable: true,
        configurable: true,
      });

      fileModel.getAttributes = jest.fn(() => ({
        id: { field: 'id' },
        uuid: { field: 'uuid' },
        userId: { field: 'user_id' },
        folderId: { field: 'folder_id' },
        folderUuid: { field: 'folder_uuid' },
        status: { field: 'status' },
        type: { field: 'type' },
        createdAt: { field: 'created_at' },
        updatedAt: { field: 'updated_at' },
      })) as any;
    });

    it('should return empty string when where object is empty', () => {
      const replacements = {};
      const result = (repository as any).buildWhereClause(
        {},
        { model: fileModel },
        replacements,
      );

      expect(result).toBe('');
      expect(replacements).toEqual({});
    });

    it('should build simple equality WHERE clause with single condition', () => {
      const replacements = {};
      const where = { uuid: 'test-uuid-123' };

      const result = (repository as any).buildWhereClause(
        where,
        { model: fileModel },
        replacements,
      );

      expect(result).toBe('WHERE "uuid" = :where_uuid_eq_0');
      expect(replacements).toEqual({ where_uuid_eq_0: 'test-uuid-123' });
    });

    it('should build WHERE clause with multiple equality conditions', () => {
      const replacements = {};
      const where = { uuid: 'test-uuid-123', userId: 2, status: 'EXISTS' };

      const result = (repository as any).buildWhereClause(
        where,
        { model: fileModel },
        replacements,
      );

      expect(result).toBe(
        'WHERE "uuid" = :where_uuid_eq_0 AND "user_id" = :where_userId_eq_1 AND "status" = :where_status_eq_2',
      );
      expect(replacements).toEqual({
        where_uuid_eq_0: 'test-uuid-123',
        where_userId_eq_1: 2,
        where_status_eq_2: 'EXISTS',
      });
    });

    it('should build WHERE clause with table alias', () => {
      const replacements = {};
      const where = { uuid: 'test-uuid-123', userId: 2 };

      const result = (repository as any).buildWhereClause(
        where,
        { model: fileModel, tableAlias: 'f' },
        replacements,
      );

      expect(result).toBe(
        'WHERE f."uuid" = :where_uuid_eq_0 AND f."user_id" = :where_userId_eq_1',
      );
      expect(replacements).toEqual({
        where_uuid_eq_0: 'test-uuid-123',
        where_userId_eq_1: 2,
      });
    });

    it('should build WHERE clause without WHERE keyword when includeWhereKeyword is false', () => {
      const replacements = {};
      const where = { uuid: 'test-uuid-123', userId: 2 };

      const result = (repository as any).buildWhereClause(
        where,
        { model: fileModel, tableAlias: 'f', includeWhereKeyword: false },
        replacements,
      );

      expect(result).toBe(
        'f."uuid" = :where_uuid_eq_0 AND f."user_id" = :where_userId_eq_1',
      );
      expect(replacements).toEqual({
        where_uuid_eq_0: 'test-uuid-123',
        where_userId_eq_1: 2,
      });
    });

    it('should handle null values with IS NULL clause', () => {
      const replacements = {};
      const where = { userId: 2, deletedAt: null };

      fileModel.getAttributes = jest.fn(() => ({
        userId: { field: 'user_id' },
        deletedAt: { field: 'deleted_at' },
      })) as any;

      const result = (repository as any).buildWhereClause(
        where,
        { model: fileModel },
        replacements,
      );

      expect(result).toBe(
        'WHERE "user_id" = :where_userId_eq_0 AND "deleted_at" IS NULL',
      );
      expect(replacements).toEqual({
        where_userId_eq_0: 2,
      });
    });

    it('should handle Op.gt operator for greater than comparisons', () => {
      const replacements = {};
      const testDate = new Date('2024-01-15');
      const where = { userId: 2, updatedAt: { [Op.gt]: testDate } };

      const result = (repository as any).buildWhereClause(
        where,
        { model: fileModel },
        replacements,
      );

      expect(result).toBe(
        'WHERE "user_id" = :where_userId_eq_0 AND "updated_at" > :where_updatedAt_gt_1',
      );
      expect(replacements).toEqual({
        where_userId_eq_0: 2,
        where_updatedAt_gt_1: testDate,
      });
    });

    it('should handle Op.gt with table alias', () => {
      const replacements = {};
      const testDate = new Date('2024-01-15');
      const where = { updatedAt: { [Op.gt]: testDate } };

      const result = (repository as any).buildWhereClause(
        where,
        { model: fileModel, tableAlias: 'f' },
        replacements,
      );

      expect(result).toBe('WHERE f."updated_at" > :where_updatedAt_gt_0');
      expect(replacements).toEqual({
        where_updatedAt_gt_0: testDate,
      });
    });

    it('should respect existing replacements counter when populating new params', () => {
      const replacements = {
        existingParam1: 'value1',
        existingParam2: 'value2',
      };
      const where = { uuid: 'test-uuid', userId: 2 };

      const result = (repository as any).buildWhereClause(
        where,
        { model: fileModel },
        replacements,
      );

      expect(result).toBe(
        'WHERE "uuid" = :where_uuid_eq_2 AND "user_id" = :where_userId_eq_3',
      );
      expect(replacements).toEqual({
        existingParam1: 'value1',
        existingParam2: 'value2',
        where_uuid_eq_2: 'test-uuid',
        where_userId_eq_3: 2,
      });
    });

    it('should convert camelCase field names to snake_case when no field mapping exists', () => {
      fileModel.getAttributes = jest.fn(() => ({
        folderId: {},
      })) as any;

      const replacements = {};
      const where = { folderId: 123 };

      const result = (repository as any).buildWhereClause(
        where,
        { model: fileModel },
        replacements,
      );

      expect(result).toBe('WHERE "folder_id" = :where_folderId_eq_0');
      expect(replacements).toEqual({
        where_folderId_eq_0: 123,
      });
    });
  });

  describe('buildOrderClause (private method)', () => {
    let mockSequelize: any;
    let mockQueryGen: any;

    beforeEach(() => {
      mockQueryGen = {
        quoteIdentifier: jest.fn((identifier: string) => `"${identifier}"`),
      };

      mockSequelize = {
        getQueryInterface: jest.fn(() => ({
          queryGenerator: mockQueryGen,
        })),
      };

      Object.defineProperty(fileModel, 'sequelize', {
        value: mockSequelize,
        writable: true,
        configurable: true,
      });

      fileModel.getAttributes = jest.fn(() => ({
        id: { field: 'id' },
        createdAt: { field: 'created_at' },
        updatedAt: { field: 'updated_at' },
        plainName: { field: 'plain_name' },
      })) as any;
    });

    it('should return default order when order array is empty', () => {
      const result = (repository as any).buildOrderClause([], {
        model: fileModel,
      });

      expect(result).toBe('created_at DESC');
    });

    it('should return custom default order when provided', () => {
      const result = (repository as any).buildOrderClause([], {
        model: fileModel,
        defaultOrder: 'id ASC',
      });

      expect(result).toBe('id ASC');
    });

    it('should build ORDER BY clause with single field', () => {
      const order: Array<[string, string]> = [['createdAt', 'DESC']];

      const result = (repository as any).buildOrderClause(order, {
        model: fileModel,
      });

      expect(result).toBe('"created_at" DESC');
    });

    it('should build ORDER BY clause with multiple fields', () => {
      const order: Array<[string, string]> = [
        ['createdAt', 'DESC'],
        ['id', 'ASC'],
      ];

      const result = (repository as any).buildOrderClause(order, {
        model: fileModel,
      });

      expect(result).toBe('"created_at" DESC, "id" ASC');
    });

    it('should build ORDER BY clause with table alias', () => {
      const order: Array<[string, string]> = [['createdAt', 'DESC']];

      const result = (repository as any).buildOrderClause(order, {
        model: fileModel,
        tableAlias: 'f',
      });

      expect(result).toBe('f."created_at" DESC');
    });

    it('should handle Sequelize Literal in order array', () => {
      const literalOrder = {
        toString: () => 'RAND()',
      };
      const order = [literalOrder] as any;

      const result = (repository as any).buildOrderClause(order, {
        model: fileModel,
      });

      expect(result).toBe('RAND()');
    });

    it('should convert camelCase field names to snake_case', () => {
      const order: Array<[string, string]> = [['plainName', 'ASC']];

      const result = (repository as any).buildOrderClause(order, {
        model: fileModel,
      });

      expect(result).toBe('"plain_name" ASC');
    });

    it('should handle mixed field types with table alias', () => {
      const order: Array<[string, string]> = [
        ['updatedAt', 'DESC'],
        ['plainName', 'ASC'],
      ];

      const result = (repository as any).buildOrderClause(order, {
        model: fileModel,
        tableAlias: 'f',
      });

      expect(result).toBe('f."updated_at" DESC, f."plain_name" ASC');
    });
  });

  describe('buildSelectFields (private method)', () => {
    let mockSequelize: any;
    let mockQueryGen: any;

    beforeEach(() => {
      mockQueryGen = {
        quoteIdentifier: jest.fn((identifier: string) => `"${identifier}"`),
      };

      mockSequelize = {
        getQueryInterface: jest.fn(() => ({
          queryGenerator: mockQueryGen,
        })),
      };

      Object.defineProperty(fileModel, 'sequelize', {
        value: mockSequelize,
        writable: true,
        configurable: true,
      });

      fileModel.getAttributes = jest.fn(() => ({
        id: { field: 'id' },
        uuid: { field: 'uuid' },
        userId: { field: 'user_id' },
        fileId: { field: 'file_id' },
        plainName: { field: 'plain_name' },
        size: { field: 'size' },
        status: { field: 'status' },
        createdAt: { field: 'created_at' },
      })) as any;
    });

    it('should build SELECT fields for all model attributes', () => {
      const result = (repository as any).buildSelectFields({
        model: fileModel,
        tableAlias: 'f',
      });

      expect(result).toContain('f.id');
      expect(result).toContain('f.uuid');
      expect(result).toContain('f.user_id as "userId"');
      expect(result).toContain('f.file_id as "fileId"');
      expect(result).toContain('f.plain_name as "plainName"');
      expect(result).toContain('f.size');
      expect(result).toContain('f.status');
      expect(result).toContain('f.created_at as "createdAt"');
    });

    it('should exclude specified fields', () => {
      const result = (repository as any).buildSelectFields({
        model: fileModel,
        tableAlias: 'f',
        excludeFields: ['fileId', 'size'],
      });

      expect(result).not.toContain('file_id');
      expect(result).not.toContain('f.size');
      expect(result).toContain('f.uuid');
      expect(result).toContain('f.user_id as "userId"');
    });

    it('should handle fields where column name equals field name (no alias needed)', () => {
      fileModel.getAttributes = jest.fn(() => ({
        id: { field: 'id' },
        uuid: { field: 'uuid' },
      })) as any;

      const result = (repository as any).buildSelectFields({
        model: fileModel,
        tableAlias: 'f',
      });

      expect(result).toBe('f.id,\n    f.uuid');
    });

    it('should handle fields with camelCase to snake_case conversion', () => {
      fileModel.getAttributes = jest.fn(() => ({
        userId: { field: 'user_id' },
        createdAt: { field: 'created_at' },
      })) as any;

      const result = (repository as any).buildSelectFields({
        model: fileModel,
        tableAlias: 'f',
      });

      expect(result).toBe(
        'f.user_id as "userId",\n    f.created_at as "createdAt"',
      );
    });

    it('should join fields with comma and newline for readability', () => {
      fileModel.getAttributes = jest.fn(() => ({
        id: { field: 'id' },
        uuid: { field: 'uuid' },
        status: { field: 'status' },
      })) as any;

      const result = (repository as any).buildSelectFields({
        model: fileModel,
        tableAlias: 'f',
      });

      expect(result).toBe('f.id,\n    f.uuid,\n    f.status');
    });

    it('should handle attributes without field mapping (fallback to snake_case)', () => {
      fileModel.getAttributes = jest.fn(() => ({
        userId: {},
        createdAt: {},
      })) as any;

      const result = (repository as any).buildSelectFields({
        model: fileModel,
        tableAlias: 'f',
      });

      expect(result).toBe(
        'f.user_id as "userId",\n    f.created_at as "createdAt"',
      );
    });
  });
});
