import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { TrashUseCases } from './trash.usecase';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { newUser, newFile, newFolder } from '../../../test/fixtures';
import { TrashEmptyRequestedEvent } from './events/trash-empty-requested.event';

describe('Trash Use Cases', () => {
  let service: TrashUseCases,
    fileUseCases: FileUseCases,
    folderUseCases: FolderUseCases,
    eventEmitter: EventEmitter2;

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
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('performTrashDeletion', () => {
    const user = newUser();

    it('When called, then it should delete all trashed files and folders in chunks', async () => {
      const filesCount = 250;
      const foldersCount = 150;

      jest
        .spyOn(folderUseCases, 'deleteUserTrashedFoldersBatch')
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50);
      jest
        .spyOn(fileUseCases, 'deleteUserTrashedFilesBatch')
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50);

      await service.performTrashDeletion(user, filesCount, foldersCount);

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
      jest
        .spyOn(folderUseCases, 'deleteUserTrashedFoldersBatch')
        .mockResolvedValue(0);
      jest
        .spyOn(fileUseCases, 'deleteUserTrashedFilesBatch')
        .mockResolvedValue(0);

      await service.performTrashDeletion(user, 0, 0);

      expect(
        folderUseCases.deleteUserTrashedFoldersBatch,
      ).not.toHaveBeenCalled();
      expect(fileUseCases.deleteUserTrashedFilesBatch).not.toHaveBeenCalled();
    });

    it('When only files exist in trash, then it should only delete files', async () => {
      const filesCount = 50;

      jest
        .spyOn(fileUseCases, 'deleteUserTrashedFilesBatch')
        .mockResolvedValue(50);
      jest
        .spyOn(folderUseCases, 'deleteUserTrashedFoldersBatch')
        .mockResolvedValue(0);

      await service.performTrashDeletion(user, filesCount, 0);

      expect(fileUseCases.deleteUserTrashedFilesBatch).toHaveBeenCalledTimes(1);
      expect(
        folderUseCases.deleteUserTrashedFoldersBatch,
      ).not.toHaveBeenCalled();
    });

    it('When only folders exist in trash, then it should only delete folders', async () => {
      const foldersCount = 75;

      jest
        .spyOn(folderUseCases, 'deleteUserTrashedFoldersBatch')
        .mockResolvedValue(75);
      jest
        .spyOn(fileUseCases, 'deleteUserTrashedFilesBatch')
        .mockResolvedValue(0);

      await service.performTrashDeletion(user, 0, foldersCount);

      expect(
        folderUseCases.deleteUserTrashedFoldersBatch,
      ).toHaveBeenCalledTimes(1);
      expect(fileUseCases.deleteUserTrashedFilesBatch).not.toHaveBeenCalled();
    });

    it('When is called with custom chunk size, then it should use that chunk size', async () => {
      const filesCount = 150;
      const foldersCount = 100;
      const chunkSize = 50;

      jest
        .spyOn(folderUseCases, 'deleteUserTrashedFoldersBatch')
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(0);
      jest
        .spyOn(fileUseCases, 'deleteUserTrashedFilesBatch')
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(0);

      await service.performTrashDeletion(
        user,
        filesCount,
        foldersCount,
        chunkSize,
      );

      expect(folderUseCases.deleteUserTrashedFoldersBatch).toHaveBeenCalledWith(
        user,
        chunkSize,
      );
      expect(fileUseCases.deleteUserTrashedFilesBatch).toHaveBeenCalledWith(
        user,
        chunkSize,
      );
    });
  });

  describe('emptyTrash', () => {
    const user = newUser();

    it('When user has more than 10,000 trashed items, then it should delete the trashed files asynchronously', async () => {
      const filesCount = 8000;
      const foldersCount = 3000;

      jest
        .spyOn(fileUseCases, 'getTrashFilesCount')
        .mockResolvedValue(filesCount);
      jest
        .spyOn(folderUseCases, 'getTrashFoldersCount')
        .mockResolvedValue(foldersCount);
      jest.spyOn(eventEmitter, 'emit').mockImplementation();

      const result = await service.emptyTrash(user);

      expect(fileUseCases.getTrashFilesCount).toHaveBeenCalledWith(user.id);
      expect(folderUseCases.getTrashFoldersCount).toHaveBeenCalledWith(user.id);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'trash.empty.requested',
        new TrashEmptyRequestedEvent(user, filesCount, foldersCount),
      );
      expect(result).toEqual({
        message: 'Empty trash operation started',
        status: 'processing',
      });
    });

    it('When user has exactly 10,000 items, then it should process synchronously', async () => {
      const filesCount = 5000;
      const foldersCount = 5000;

      jest
        .spyOn(fileUseCases, 'getTrashFilesCount')
        .mockResolvedValue(filesCount);
      jest
        .spyOn(folderUseCases, 'getTrashFoldersCount')
        .mockResolvedValue(foldersCount);
      jest
        .spyOn(folderUseCases, 'deleteUserTrashedFoldersBatch')
        .mockResolvedValue(100);
      jest
        .spyOn(fileUseCases, 'deleteUserTrashedFilesBatch')
        .mockResolvedValue(100);
      jest.spyOn(eventEmitter, 'emit').mockImplementation();
      jest.spyOn(service, 'performTrashDeletion').mockResolvedValue();

      const result = await service.emptyTrash(user);

      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(service.performTrashDeletion).toHaveBeenCalledWith(
        user,
        filesCount,
        foldersCount,
        100,
      );
      expect(result).toEqual({
        message: 'Trash emptied successfully',
        status: 'completed',
      });
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
