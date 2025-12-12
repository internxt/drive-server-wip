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
import { Time } from '../../lib/time';

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

  describe('sumFileSizeDeltaFromDate', () => {
    const userId = 123;
    const sinceDate = Time.now('2024-01-01');

    it('When files have size delta, then it should return the total delta', async () => {
      const totalDelta = 1500;
      const result = [{ total: totalDelta }];

      jest.spyOn(fileModel, 'findAll').mockResolvedValueOnce(result as any);

      const response = await repository.sumFileSizeDeltaFromDate(
        userId,
        sinceDate,
      );

      expect(fileModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
          }),
          bind: {
            sinceDate,
          },
          raw: true,
        }),
      );
      expect(response).toBe(totalDelta);
    });

    it('When no files are found or total is null, then it should return 0', async () => {
      const result = [{ total: null }];

      jest.spyOn(fileModel, 'findAll').mockResolvedValueOnce(result as any);

      const response = await repository.sumFileSizeDeltaFromDate(
        userId,
        sinceDate,
      );

      expect(response).toBe(0);
    });
  });

  describe('getZeroSizeFilesCountByUser', () => {
    it('When user zero-size files are requested, then it should make the query with expected parameters', async () => {
      const userId = 123;
      const count = 2;

      jest.spyOn(fileModel, 'findAndCountAll').mockResolvedValueOnce({
        rows: [],
        count,
      } as any);

      const result = await repository.getZeroSizeFilesCountByUser(userId);

      expect(fileModel.findAndCountAll).toHaveBeenCalledWith({
        where: {
          userId,
          size: 0,
          status: {
            [Op.not]: FileStatus.DELETED,
          },
        },
      });
      expect(result).toBe(count);
    });
  });
});
