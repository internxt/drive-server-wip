import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { createMock } from '@golevelup/ts-jest';
import { newFile, newUser, newWorkspace } from '../../../test/fixtures';
import { FileAttributes, FileStatus } from './file.domain';
import { FileModel } from './file.model';
import { FileRepository, SequelizeFileRepository } from './file.repository';
import { Op } from 'sequelize';
import { v4 } from 'uuid';

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
});
