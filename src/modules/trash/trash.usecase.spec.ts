import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';

import { TrashUseCases } from './trash.usecase';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { newUser, newFile, newFolder } from '../../../test/fixtures';

describe('Trash Use Cases', () => {
  let service: TrashUseCases,
    fileUseCases: FileUseCases,
    folderUseCases: FolderUseCases;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrashUseCases],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    service = module.get<TrashUseCases>(TrashUseCases);
    fileUseCases = module.get<FileUseCases>(FileUseCases);
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('emptyTrash', () => {
    const user = newUser();

    it('When emptyTrash is called, then it should delete all trashed files and folders in chunks', async () => {
      const filesCount = 250;
      const foldersCount = 150;

      jest
        .spyOn(fileUseCases, 'getTrashFilesCount')
        .mockResolvedValue(filesCount);
      jest
        .spyOn(folderUseCases, 'getTrashFoldersCount')
        .mockResolvedValue(foldersCount);
      jest
        .spyOn(folderUseCases, 'deleteUserTrashedFoldersBatch')
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50);
      jest
        .spyOn(fileUseCases, 'deleteUserTrashedFilesBatch')
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50);

      await service.emptyTrash(user);

      expect(fileUseCases.getTrashFilesCount).toHaveBeenCalledWith(user.id);
      expect(folderUseCases.getTrashFoldersCount).toHaveBeenCalledWith(user.id);

      // Should be called twice for folders (150 count / 100 chunk size = 2 calls)
      expect(
        folderUseCases.deleteUserTrashedFoldersBatch,
      ).toHaveBeenCalledTimes(2);
      expect(
        folderUseCases.deleteUserTrashedFoldersBatch,
      ).toHaveBeenNthCalledWith(1, user, 100);
      expect(
        folderUseCases.deleteUserTrashedFoldersBatch,
      ).toHaveBeenNthCalledWith(2, user, 100);

      // Should be called three times for files (250 count / 100 chunk size = 3 calls)
      expect(fileUseCases.deleteUserTrashedFilesBatch).toHaveBeenCalledTimes(3);
      expect(fileUseCases.deleteUserTrashedFilesBatch).toHaveBeenNthCalledWith(
        1,
        user,
        100,
      );
      expect(fileUseCases.deleteUserTrashedFilesBatch).toHaveBeenNthCalledWith(
        2,
        user,
        100,
      );
      expect(fileUseCases.deleteUserTrashedFilesBatch).toHaveBeenNthCalledWith(
        3,
        user,
        100,
      );
    });

    it('When there are no trashed items, then it should not call delete methods', async () => {
      jest.spyOn(fileUseCases, 'getTrashFilesCount').mockResolvedValue(0);
      jest.spyOn(folderUseCases, 'getTrashFoldersCount').mockResolvedValue(0);
      jest
        .spyOn(folderUseCases, 'deleteUserTrashedFoldersBatch')
        .mockResolvedValue(0);
      jest
        .spyOn(fileUseCases, 'deleteUserTrashedFilesBatch')
        .mockResolvedValue(0);

      await service.emptyTrash(user);

      expect(
        folderUseCases.deleteUserTrashedFoldersBatch,
      ).not.toHaveBeenCalled();
      expect(fileUseCases.deleteUserTrashedFilesBatch).not.toHaveBeenCalled();
    });

    it('When only files exist in trash, then it should only delete files', async () => {
      const filesCount = 50;

      jest
        .spyOn(fileUseCases, 'getTrashFilesCount')
        .mockResolvedValue(filesCount);
      jest.spyOn(folderUseCases, 'getTrashFoldersCount').mockResolvedValue(0);
      jest
        .spyOn(fileUseCases, 'deleteUserTrashedFilesBatch')
        .mockResolvedValue(50);
      jest
        .spyOn(folderUseCases, 'deleteUserTrashedFoldersBatch')
        .mockResolvedValue(0);

      await service.emptyTrash(user);

      expect(fileUseCases.deleteUserTrashedFilesBatch).toHaveBeenCalledTimes(1);
      expect(
        folderUseCases.deleteUserTrashedFoldersBatch,
      ).not.toHaveBeenCalled();
    });

    it('When only folders exist in trash, then it should only delete folders', async () => {
      const foldersCount = 75;

      jest.spyOn(fileUseCases, 'getTrashFilesCount').mockResolvedValue(0);
      jest
        .spyOn(folderUseCases, 'getTrashFoldersCount')
        .mockResolvedValue(foldersCount);
      jest
        .spyOn(folderUseCases, 'deleteUserTrashedFoldersBatch')
        .mockResolvedValue(75);
      jest
        .spyOn(fileUseCases, 'deleteUserTrashedFilesBatch')
        .mockResolvedValue(0);

      await service.emptyTrash(user);

      expect(
        folderUseCases.deleteUserTrashedFoldersBatch,
      ).toHaveBeenCalledTimes(1);
      expect(fileUseCases.deleteUserTrashedFilesBatch).not.toHaveBeenCalled();
    });
  });

  describe('deleteItems', () => {
    const user = newUser();

    it('When deleteItems is called with files and folders, then it should delete items in chunks', async () => {
      const files = Array.from({ length: 25 }, () => newFile());
      const folders = Array.from({ length: 15 }, () => newFolder());

      jest.spyOn(fileUseCases, 'deleteByUser').mockResolvedValue();
      jest.spyOn(folderUseCases, 'deleteByUser').mockResolvedValue();

      await service.deleteItems(user, files, folders);

      // Files: 25 items / 10 chunk size = 3 calls
      expect(fileUseCases.deleteByUser).toHaveBeenCalledTimes(3);
      // Folders: 15 items / 10 chunk size = 2 calls
      expect(folderUseCases.deleteByUser).toHaveBeenCalledTimes(2);
    });

    it('When deleteItems is called with empty arrays, then it should not call delete methods', async () => {
      jest.spyOn(fileUseCases, 'deleteByUser').mockResolvedValue();
      jest.spyOn(folderUseCases, 'deleteByUser').mockResolvedValue();

      await service.deleteItems(user, [], []);

      expect(fileUseCases.deleteByUser).not.toHaveBeenCalled();
      expect(folderUseCases.deleteByUser).not.toHaveBeenCalled();
    });

    it('When deleteItems is called with only files, then it should only delete files', async () => {
      const files = Array.from({ length: 5 }, () => newFile());

      jest.spyOn(fileUseCases, 'deleteByUser').mockResolvedValue();
      jest.spyOn(folderUseCases, 'deleteByUser').mockResolvedValue();

      await service.deleteItems(user, files, []);

      expect(fileUseCases.deleteByUser).toHaveBeenCalledTimes(1);
      expect(folderUseCases.deleteByUser).not.toHaveBeenCalled();
    });

    it('When deleteItems is called with only folders, then it should only delete folders', async () => {
      const folders = Array.from({ length: 3 }, () => newFolder());

      jest.spyOn(fileUseCases, 'deleteByUser').mockResolvedValue();
      jest.spyOn(folderUseCases, 'deleteByUser').mockResolvedValue();

      await service.deleteItems(user, [], folders);

      expect(fileUseCases.deleteByUser).not.toHaveBeenCalled();
      expect(folderUseCases.deleteByUser).toHaveBeenCalledTimes(1);
    });

    it('When deleteItems processes large amounts of items, then it should handle chunking correctly', async () => {
      const files = Array.from({ length: 32 }, () => newFile());
      const folders = Array.from({ length: 28 }, () => newFolder());

      jest.spyOn(fileUseCases, 'deleteByUser').mockResolvedValue();
      jest.spyOn(folderUseCases, 'deleteByUser').mockResolvedValue();

      await service.deleteItems(user, files, folders);

      // Files: 32 items / 10 chunk size = 4 calls
      expect(fileUseCases.deleteByUser).toHaveBeenCalledTimes(4);
      // Folders: 28 items / 10 chunk size = 3 calls
      expect(folderUseCases.deleteByUser).toHaveBeenCalledTimes(3);

      const fileDeleteCalls = (fileUseCases.deleteByUser as jest.Mock).mock
        .calls;
      const folderDeleteCalls = (folderUseCases.deleteByUser as jest.Mock).mock
        .calls;

      expect(fileDeleteCalls[fileDeleteCalls.length - 1][1]).toHaveLength(2); // Last file chunk
      expect(folderDeleteCalls[folderDeleteCalls.length - 1][1]).toHaveLength(
        8,
      ); // Last folder chunk
    });
  });
});
