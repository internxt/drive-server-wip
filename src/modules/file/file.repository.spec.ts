import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { createMock } from '@golevelup/ts-jest';
import { newUser, newWorkspace } from '../../../test/fixtures';
import { FileStatus } from './file.domain';
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
      const options = {
        limit: 100,
        offset: 0,
        createdFrom: new Date('2023-01-01'),
      };
      const fileSizes = [{ size: '100' }, { size: '200' }];

      jest.spyOn(fileModel, 'findAll').mockResolvedValueOnce(fileSizes as any);

      const result = await repository.getSumSizeOfFilesByStatuses(
        user.uuid,
        workspace.id,
        statuses,
        options,
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
              createdAt: { [Op.gte]: options.createdFrom },
            }),
          }),
        }),
      );
      expect(result).toEqual(fileSizes);
    });

    it('When files removed from a specific date are fetch, then it should include the date in the query', async () => {
      const statuses = [FileStatus.DELETED];
      const options = {
        limit: 100,
        offset: 0,
        removedFrom: new Date('2023-01-01'),
      };
      const fileSizes = [{ size: '100' }, { size: '200' }];

      jest.spyOn(fileModel, 'findAll').mockResolvedValueOnce(fileSizes as any);

      const result = await repository.getSumSizeOfFilesByStatuses(
        user.uuid,
        workspace.id,
        statuses,
        options,
      );

      expect(fileModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: expect.arrayContaining([{ status: statuses[0] }]),
            removedAt: { [Op.gte]: options.removedFrom },
          }),
        }),
      );
      expect(result).toEqual(fileSizes);
    });
  });

  describe('findFileByFolderUuid', () => {
    const folderUuid = v4();

    it('When a file is searched, then it should handle the dynamic input', async () => {
      const searchCriteria = { plainName: ['Report'], type: 'pdf' };

      await repository.findFileByFolderUuid(folderUuid, searchCriteria);

      expect(fileModel.findAll).toHaveBeenCalledWith({
        where: expect.objectContaining({
          folderUuid,
          plainName: {
            [Op.in]: searchCriteria.plainName,
          },
          type: searchCriteria.type,
          status: FileStatus.EXISTS,
        }),
      });
    });
  });
});
