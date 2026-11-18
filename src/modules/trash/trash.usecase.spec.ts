import { Test, type TestingModule } from '@nestjs/testing';
import { ConflictException, type Logger } from '@nestjs/common';
import { v4 } from 'uuid';
import { createMock } from '@golevelup/ts-jest';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { TrashUseCases } from './trash.usecase';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { FavoriteUseCases } from '../favorite/favorite.usecase';
import { newUser, newFile, newFolder } from '../../../test/fixtures';
import { TrashEmptyRequestedEvent } from './events/trash-empty-requested.event';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { type File, FileStatus } from '../file/file.domain';
import { Folder } from '../folder/folder.domain';
import { ItemToTrashType } from './dto/controllers/move-items-to-trash.dto';
import { RestoreFailureReason } from './dto/controllers/restore-items-from-trash.dto';

describe('Trash Use Cases', () => {
  let service: TrashUseCases,
    fileUseCases: FileUseCases,
    folderUseCases: FolderUseCases,
    favoriteUseCases: FavoriteUseCases,
    eventEmitter: EventEmitter2,
    featureLimitService: FeatureLimitService;

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
    favoriteUseCases = module.get<FavoriteUseCases>(FavoriteUseCases);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    featureLimitService = module.get<FeatureLimitService>(FeatureLimitService);
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

    it('When the trash deletion finishes, then it sweeps the favorites of the removed items', async () => {
      jest
        .spyOn(folderUseCases, 'deleteUserTrashedFoldersBatch')
        .mockResolvedValue(0);
      jest
        .spyOn(fileUseCases, 'deleteUserTrashedFilesBatch')
        .mockResolvedValue(0);
      jest
        .spyOn(favoriteUseCases, 'removeOrphanedFavorites')
        .mockResolvedValue(undefined);

      await service.performTrashDeletion(user, 10, 10);

      expect(favoriteUseCases.removeOrphanedFavorites).toHaveBeenCalledWith(
        user,
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

  describe('getTrashRetentionDays', () => {
    const user = newUser();

    it('When user has no limit configured, then should return the default retention days', async () => {
      jest
        .spyOn(featureLimitService, 'getUserLimitByLabel')
        .mockResolvedValue(null);

      const result = await service.getTrashRetentionDays(user);

      expect(result).toBe(null);
    });

    it('When user has a limit configured, then should return that limit value', async () => {
      jest
        .spyOn(featureLimitService, 'getUserLimitByLabel')
        .mockResolvedValue({ value: '30' } as any);

      const result = await service.getTrashRetentionDays(user);

      expect(result).toBe(30);
    });
  });

  describe('restoreItems', () => {
    const user = newUser();
    const documents = newFolder({ owner: user });
    const photosOfMonday = newFolder({ owner: user });

    const givenFilesOnTheServer = (files: File[]) => {
      jest
        .spyOn(fileUseCases, 'getByUuids')
        .mockImplementation(async (uuids) =>
          files.filter(({ uuid }) => uuids.includes(uuid)),
        );
      jest
        .spyOn(fileUseCases, 'moveFile')
        .mockImplementation(async (_user, fileUuid) =>
          files.find(({ uuid }) => uuid === fileUuid),
        );
    };

    const givenFoldersOnTheServer = (folders: Folder[]) => {
      jest
        .spyOn(folderUseCases, 'getByUuids')
        .mockImplementation(async (uuids) =>
          folders.filter(({ uuid }) => uuids.includes(uuid)),
        );
      jest
        .spyOn(folderUseCases, 'moveFolder')
        .mockImplementation(async (_user, folderUuid) =>
          folders.find(({ uuid }) => uuid === folderUuid),
        );
    };

    const trashedFileIn = (folder: Folder, owner = user) =>
      newFile({
        owner,
        attributes: {
          folderUuid: folder.uuid,
          folderId: folder.id,
          status: FileStatus.TRASHED,
        },
      });

    const trashedFolderIn = (parent: Folder) =>
      newFolder({
        owner: user,
        attributes: {
          parentUuid: parent.uuid,
          parentId: parent.id,
          deleted: true,
        },
      });

    const asItem = (item: File | Folder) => ({
      uuid: item.uuid,
      type:
        item instanceof Folder ? ItemToTrashType.FOLDER : ItemToTrashType.FILE,
    });

    it('When a trashed file and a trashed folder are restored, then each goes back to the folder it was trashed from', async () => {
      const photo = trashedFileIn(photosOfMonday);
      const invoices = trashedFolderIn(documents);
      givenFilesOnTheServer([photo]);
      givenFoldersOnTheServer([documents, photosOfMonday, invoices]);

      const result = await service.restoreItems(user, [
        asItem(photo),
        asItem(invoices),
      ]);

      expect(result).toEqual({
        restoredFiles: [photo],
        restoredFolders: [invoices],
        failed: [],
      });
      expect(fileUseCases.moveFile).toHaveBeenCalledWith(user, photo.uuid, {
        destinationFolder: photosOfMonday.uuid,
      });
      expect(folderUseCases.moveFolder).toHaveBeenCalledWith(
        user,
        invoices.uuid,
        { destinationFolder: documents.uuid },
      );
    });

    it('When the folder an item was trashed from is in the trash or deleted, then it is not restored', async () => {
      const trashedParent = newFolder({
        owner: user,
        attributes: { deleted: true },
      });
      const deletedParent = newFolder({
        owner: user,
        attributes: { deleted: true, removed: true },
      });
      const photo = trashedFileIn(trashedParent);
      const invoices = trashedFolderIn(deletedParent);
      givenFilesOnTheServer([photo]);
      givenFoldersOnTheServer([trashedParent, deletedParent, invoices]);

      const result = await service.restoreItems(user, [
        asItem(photo),
        asItem(invoices),
      ]);

      expect(result).toEqual({
        restoredFiles: [],
        restoredFolders: [],
        failed: [
          {
            ...asItem(invoices),
            reason: RestoreFailureReason.ParentNotAvailable,
          },
          {
            ...asItem(photo),
            reason: RestoreFailureReason.ParentNotAvailable,
          },
        ],
      });
      expect(fileUseCases.moveFile).not.toHaveBeenCalled();
      expect(folderUseCases.moveFolder).not.toHaveBeenCalled();
    });

    it('When a trashed folder is restored with an item trashed from it, then both go back', async () => {
      const invoices = trashedFolderIn(documents);
      const invoice = trashedFileIn(invoices);
      const restoredInvoices = newFolder({
        owner: user,
        attributes: { uuid: invoices.uuid, parentUuid: documents.uuid },
      });
      givenFilesOnTheServer([invoice]);
      givenFoldersOnTheServer([documents, invoices]);
      jest
        .spyOn(folderUseCases, 'moveFolder')
        .mockResolvedValueOnce(restoredInvoices);

      const result = await service.restoreItems(user, [
        asItem(invoice),
        asItem(invoices),
      ]);

      expect(result).toEqual({
        restoredFiles: [invoice],
        restoredFolders: [restoredInvoices],
        failed: [],
      });
    });

    it('When an item with the same name is already in its folder, then it is reported as a name conflict', async () => {
      const report = trashedFileIn(documents);
      givenFilesOnTheServer([report]);
      givenFoldersOnTheServer([documents]);
      jest
        .spyOn(fileUseCases, 'moveFile')
        .mockRejectedValueOnce(
          new ConflictException(
            'A file with the same name already exists in destination folder',
          ),
        );

      const result = await service.restoreItems(user, [asItem(report)]);

      expect(result).toEqual({
        restoredFiles: [],
        restoredFolders: [],
        failed: [
          { ...asItem(report), reason: RestoreFailureReason.NameConflict },
        ],
      });
    });

    it('When an item is not in the trash, does not exist or belongs to someone else, then only that item is not restored', async () => {
      const notTrashed = newFile({
        owner: user,
        attributes: { folderUuid: documents.uuid },
      });
      const ofSomeoneElse = trashedFileIn(documents, newUser());
      const notTrashedFolder = newFolder({
        owner: user,
        attributes: { parentUuid: documents.uuid },
      });
      const missing = { uuid: v4(), type: ItemToTrashType.FILE };
      const report = trashedFileIn(documents);
      givenFilesOnTheServer([notTrashed, ofSomeoneElse, report]);
      givenFoldersOnTheServer([documents, notTrashedFolder]);

      const result = await service.restoreItems(user, [
        asItem(notTrashed),
        asItem(ofSomeoneElse),
        asItem(notTrashedFolder),
        missing,
        asItem(report),
      ]);

      expect(result).toEqual({
        restoredFiles: [report],
        restoredFolders: [],
        failed: [
          asItem(notTrashedFolder),
          asItem(notTrashed),
          asItem(ofSomeoneElse),
          missing,
        ].map((item) => ({
          ...item,
          reason: RestoreFailureReason.NotRestorable,
        })),
      });
    });

    it('When moving one item fails unexpectedly, then the rest are still restored', async () => {
      const broken = trashedFileIn(documents);
      const report = trashedFileIn(documents);
      givenFilesOnTheServer([broken, report]);
      givenFoldersOnTheServer([documents]);
      jest
        .spyOn(fileUseCases, 'moveFile')
        .mockRejectedValueOnce(new Error('Connection lost'));

      const result = await service.restoreItems(user, [
        asItem(broken),
        asItem(report),
      ]);

      expect(result).toEqual({
        restoredFiles: [report],
        restoredFolders: [],
        failed: [
          { ...asItem(broken), reason: RestoreFailureReason.NotRestorable },
        ],
      });
    });
  });
});
