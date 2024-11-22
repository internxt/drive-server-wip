import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { createMock } from '@golevelup/ts-jest';
import { newUser, newWorkspace } from '../../../test/fixtures';
import { File, FileStatus } from './file.domain';
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

  describe('updateManyByFileIdAndUserId', () => {
    it('When params are passed, then it should update files', async () => {
      const fileIds = [v4(), v4()];
      const updateData: Partial<File> = {
        deleted: false,
        deletedAt: null,
        status: FileStatus.EXISTS,
      };

      await repository.updateManyByFileIdAndUserId(
        fileIds,
        user.id,
        updateData,
      );

      expect(fileModel.update).toHaveBeenCalledWith(updateData, {
        where: {
          userId: user.id,
          fileId: {
            [Op.in]: fileIds,
          },
        },
      });
    });
  });

  describe('trashFilesByUserAndFolderUuids', () => {
    it('When params are passed, then it should update files', async () => {
      const folderUuids = [v4(), v4()];

      await repository.trashFilesByUserAndFolderUuids(user, folderUuids);

      expect(fileModel.update).toHaveBeenCalledWith(
        {
          deleted: true,
          deletedAt: new Date(),
          status: FileStatus.TRASHED,
          updatedAt: new Date(),
        },
        {
          where: {
            userId: user.id,
            removed: false,
            folderUuid: {
              [Op.in]: folderUuids,
            },
          },
        },
      );
    });
  });

  describe('update', () => {
    const user = newUser();
    const whereOptions: Partial<File> = {
      status: FileStatus.TRASHED,
    };
    const updateData: Partial<File> = {
      status: FileStatus.EXISTS,
    };

    it('should update files when valid parameters are passed', async () => {
      await repository.update(user.id, whereOptions, updateData);

      expect(fileModel.update).toHaveBeenCalledWith(updateData, {
        where: { userId: user.id, ...whereOptions },
      });
    });

    it('should throw an error when the update fails', async () => {
      const errorMessage = 'Update failed';
      jest
        .spyOn(fileModel, 'update')
        .mockRejectedValueOnce(new Error(errorMessage));

      await expect(
        repository.update(user.id, whereOptions, updateData),
      ).rejects.toThrow(errorMessage);

      expect(fileModel.update).toHaveBeenCalledWith(updateData, {
        where: { userId: user.id, ...whereOptions },
      });
    });

    it('should handle empty whereOptions gracefully', async () => {
      const emptyWhereOptions: Partial<File> = {};
      await repository.update(user.id, emptyWhereOptions, updateData);

      expect(fileModel.update).toHaveBeenCalledWith(updateData, {
        where: { userId: user.id },
      });
    });

    it('should handle empty updateData gracefully', async () => {
      const emptyUpdateData: Partial<File> = {};
      await repository.update(user.id, whereOptions, emptyUpdateData);

      expect(fileModel.update).toHaveBeenCalledWith(emptyUpdateData, {
        where: { userId: user.id, ...whereOptions },
      });
    });
  });

  describe('findAllByUserAndFolderUuids', () => {
    const user = newUser();
    const folderUuids = [v4(), v4()];

    it('When params are passed, then the files found should be returned', async () => {
      const whereConditionsEmpty = {};
      await repository.findAllByUserAndFolderUuids(user, folderUuids);

      expect(fileModel.findAll).toHaveBeenCalledWith({
        where: {
          userId: user.id,
          folderUuid: { [Op.in]: folderUuids },
          ...whereConditionsEmpty,
        },
      });
    });

    it('should include additional where conditions', async () => {
      const whereConditions = { deleted: false };

      await repository.findAllByUserAndFolderUuids(
        user,
        folderUuids,
        whereConditions,
      );

      expect(fileModel.findAll).toHaveBeenCalledWith({
        where: {
          userId: user.id,
          folderUuid: { [Op.in]: folderUuids },
          ...whereConditions,
        },
      });
    });

    it('should return an empty array if no files are found', async () => {
      jest.spyOn(fileModel, 'findAll').mockResolvedValue([]);

      const result = await repository.findAllByUserAndFolderUuids(
        user,
        folderUuids,
      );

      expect(result).toEqual([]);
    });
  });
});
