import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';

import { TrashUseCases } from './trash.usecase';
import { FileStatus } from '../file/file.domain';
import { User } from '../user/user.domain';
import { Folder, FolderAttributes } from '../folder/folder.domain';
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
      const filesCount = 2250;
      const foldersCount = 1150;
      const mockFiles = Array.from({ length: 1000 }, () =>
        newFile({ attributes: { status: FileStatus.TRASHED } }),
      );
      const mockFolders = Array.from({ length: 1000 }, () =>
        newFolder({ attributes: { deleted: true, removed: false } }),
      );

      jest
        .spyOn(fileUseCases, 'getTrashFilesCount')
        .mockResolvedValue(filesCount);
      jest
        .spyOn(folderUseCases, 'getTrashFoldersCount')
        .mockResolvedValue(foldersCount);
      jest.spyOn(folderUseCases, 'getFolders').mockResolvedValue(mockFolders);
      jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue(mockFiles);
      jest.spyOn(folderUseCases, 'deleteByUser').mockResolvedValue();
      jest.spyOn(fileUseCases, 'deleteByUser').mockResolvedValue();

      await service.emptyTrash(user);

      expect(fileUseCases.getTrashFilesCount).toHaveBeenCalledWith(user.id);
      expect(folderUseCases.getTrashFoldersCount).toHaveBeenCalledWith(user.id);

      // Should be called twice for folders (1150 count / 1000 chunk size = 2 calls)
      expect(folderUseCases.getFolders).toHaveBeenCalledTimes(2);
      expect(folderUseCases.deleteByUser).toHaveBeenCalledTimes(2);

      // Should be called three times for files (2250 count / 1000 chunk size = 3 calls)
      expect(fileUseCases.getFiles).toHaveBeenCalledTimes(3);
      expect(fileUseCases.deleteByUser).toHaveBeenCalledTimes(3);
    });

    it('When there are no trashed items, then it should not call delete methods', async () => {
      jest.spyOn(fileUseCases, 'getTrashFilesCount').mockResolvedValue(0);
      jest.spyOn(folderUseCases, 'getTrashFoldersCount').mockResolvedValue(0);
      jest.spyOn(folderUseCases, 'deleteByUser').mockResolvedValue();
      jest.spyOn(fileUseCases, 'deleteByUser').mockResolvedValue();

      await service.emptyTrash(user);

      expect(folderUseCases.deleteByUser).not.toHaveBeenCalled();
      expect(fileUseCases.deleteByUser).not.toHaveBeenCalled();
    });

    it('When only files exist in trash, then it should only delete files', async () => {
      const filesCount = 50;
      const mockFiles = Array.from({ length: 50 }, () =>
        newFile({ attributes: { status: FileStatus.TRASHED } }),
      );

      jest
        .spyOn(fileUseCases, 'getTrashFilesCount')
        .mockResolvedValue(filesCount);
      jest.spyOn(folderUseCases, 'getTrashFoldersCount').mockResolvedValue(0);
      jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue(mockFiles);
      jest.spyOn(folderUseCases, 'deleteByUser').mockResolvedValue();
      jest.spyOn(fileUseCases, 'deleteByUser').mockResolvedValue();

      await service.emptyTrash(user);

      expect(fileUseCases.deleteByUser).toHaveBeenCalledTimes(1);
      expect(folderUseCases.deleteByUser).not.toHaveBeenCalled();
    });

    it('When only folders exist in trash, then it should only delete folders', async () => {
      const foldersCount = 75;
      const mockFolders = Array.from({ length: 75 }, () =>
        newFolder({ attributes: { deleted: true, removed: false } }),
      );

      jest.spyOn(fileUseCases, 'getTrashFilesCount').mockResolvedValue(0);
      jest
        .spyOn(folderUseCases, 'getTrashFoldersCount')
        .mockResolvedValue(foldersCount);
      jest.spyOn(folderUseCases, 'getFolders').mockResolvedValue(mockFolders);
      jest.spyOn(folderUseCases, 'deleteByUser').mockResolvedValue();
      jest.spyOn(fileUseCases, 'deleteByUser').mockResolvedValue();

      await service.emptyTrash(user);

      expect(folderUseCases.deleteByUser).toHaveBeenCalledTimes(1);
      expect(fileUseCases.deleteByUser).not.toHaveBeenCalled();
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

    it('should fail if a folder is not found', async () => {
      const error = Error('random error');
      const foldersIdToDelete: Array<FolderAttributes['id']> = [
        2176796544, 505779655, 724413021,
      ];

      jest.spyOn(fileUseCases, 'getByFileIdAndUser');
      jest
        .spyOn(folderUseCases, 'getFolder')
        .mockImplementationOnce(() => Promise.resolve({} as Folder))
        .mockImplementationOnce(() => Promise.reject(error))
        .mockImplementationOnce(() => Promise.resolve({} as Folder));
      jest.spyOn(fileUseCases, 'deleteFilePermanently');
      jest.spyOn(folderUseCases, 'deleteFolderPermanently');

      try {
        await service.deleteItems(
          {} as User,
          [],
          foldersIdToDelete as unknown as Folder[], // must be updated to be a list of folders
        );
      } catch (err) {
        expect(err).toBeDefined();
      }

      expect(fileUseCases.deleteFilePermanently).not.toHaveBeenCalled();
      expect(folderUseCases.deleteFolderPermanently).not.toHaveBeenCalled();
    });
  });
});
