import { createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { newFolder } from '../../../test/fixtures';
import { FileUseCases } from '../file/file.usecase';
import { FolderController } from './folder.controller';
import { Folder } from './folder.domain';
import { FolderUseCases } from './folder.usecase';
import { CalculateFolderSizeTimeoutException } from './exception/calculate-folder-size-timeout.exception';

describe('FolderController', () => {
  let folderController: FolderController;
  let folderUseCases: FolderUseCases;
  let folder: Folder;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FolderController],
      providers: [
        { provide: FolderUseCases, useValue: createMock() },
        { provide: FileUseCases, useValue: createMock() },
      ],
    }).compile();

    folderController = module.get<FolderController>(FolderController);
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
    folder = newFolder();
  });

  describe('get folder size', () => {
    it('When get folder size is requested, then return the folder size', async () => {
      const expectedSize = 100;
      jest
        .spyOn(folderUseCases, 'getFolderSizeByUuid')
        .mockResolvedValue(expectedSize);

      const result = await folderController.getFolderSize(folder.uuid);
      expect(result).toEqual({ size: expectedSize });
    });

    it('When get folder size times out, then throw an exception', async () => {
      jest
        .spyOn(folderUseCases, 'getFolderSizeByUuid')
        .mockRejectedValue(new CalculateFolderSizeTimeoutException());

      await expect(folderController.getFolderSize(folder.uuid)).rejects.toThrow(
        CalculateFolderSizeTimeoutException,
      );
    });
  });
});
