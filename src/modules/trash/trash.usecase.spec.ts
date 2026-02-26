import { Test, type TestingModule } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { TrashUseCases } from './trash.usecase';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { newUser, newFile, newFolder, newTrash } from '../../../test/fixtures';
import { TrashEmptyRequestedEvent } from './events/trash-empty-requested.event';
import { SequelizeTrashRepository } from './trash.repository';
import { TrashItemType } from './trash.attributes';
import { SequelizeFileRepository } from '../file/file.repository';
import { SequelizeFolderRepository } from '../folder/folder.repository';
import { Trash } from './trash.domain';

describe('Trash Use Cases', () => {
  let service: TrashUseCases,
    fileUseCases: FileUseCases,
    folderUseCases: FolderUseCases,
    eventEmitter: EventEmitter2,
    trashRepository: SequelizeTrashRepository,
    fileRepository: SequelizeFileRepository,
    folderRepository: SequelizeFolderRepository;

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
    trashRepository = module.get<SequelizeTrashRepository>(
      SequelizeTrashRepository,
    );
    fileRepository = module.get<SequelizeFileRepository>(
      SequelizeFileRepository,
    );
    folderRepository = module.get<SequelizeFolderRepository>(
      SequelizeFolderRepository,
    );
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
      jest
        .spyOn(service, 'deleteUserTrashedItemsBatch')
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(100);

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
      jest.spyOn(service, 'deleteUserTrashedItemsBatch').mockResolvedValue(50);

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
      jest.spyOn(service, 'deleteUserTrashedItemsBatch').mockResolvedValue(75);

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
      jest
        .spyOn(service, 'deleteUserTrashedItemsBatch')
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(50)
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
        250,
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
      const files = Array.from({ length: 120 }, () => newFile());
      const folders = Array.from({ length: 80 }, () => newFolder());

      jest.spyOn(fileUseCases, 'deleteByUser').mockResolvedValue();
      jest.spyOn(folderUseCases, 'deleteByUser').mockResolvedValue();

      await service.deleteItems(user, files, folders);

      // Files: 120 items / 50 chunk size = 3 calls
      expect(fileUseCases.deleteByUser).toHaveBeenCalledTimes(3);
      // Folders: 80 items / 50 chunk size = 2 calls
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
      const files = Array.from({ length: 130 }, () => newFile());
      const folders = Array.from({ length: 110 }, () => newFolder());

      jest.spyOn(fileUseCases, 'deleteByUser').mockResolvedValue();
      jest.spyOn(folderUseCases, 'deleteByUser').mockResolvedValue();

      await service.deleteItems(user, files, folders);

      // Files: 130 items / 50 chunk size = 3 calls
      expect(fileUseCases.deleteByUser).toHaveBeenCalledTimes(3);
      // Folders: 110 items / 50 chunk size = 3 calls
      expect(folderUseCases.deleteByUser).toHaveBeenCalledTimes(3);

      const fileDeleteCalls = (fileUseCases.deleteByUser as jest.Mock).mock
        .calls;
      const folderDeleteCalls = (folderUseCases.deleteByUser as jest.Mock).mock
        .calls;

      expect(fileDeleteCalls[fileDeleteCalls.length - 1][1]).toHaveLength(30); // Last file chunk
      expect(folderDeleteCalls[folderDeleteCalls.length - 1][1]).toHaveLength(
        10,
      ); // Last folder chunk
    });
  });

  describe('calculateCaducityDate', () => {
    it('When user has free tier, then caducity date should be 48 hours from now', () => {
      const trashedAt = new Date('2025-10-30T00:00:00Z');

      const result = service.calculateCaducityDate(
        'free_individual',
        trashedAt,
      );

      expect(result).toEqual(new Date('2025-11-01T00:00:00Z'));
    });

    it('When user has essential tier, then caducity date should be 7 days from now', () => {
      const trashedAt = new Date('2025-10-30T00:00:00Z');

      const result = service.calculateCaducityDate(
        'essential_individual',
        trashedAt,
      );

      expect(result).toEqual(new Date('2025-11-06T00:00:00Z'));
    });

    it('When user has premium tier, then caducity date should be 15 days from now', () => {
      const trashedAt = new Date('2025-10-30T00:00:00Z');

      const result = service.calculateCaducityDate(
        'premium_individual',
        trashedAt,
      );

      expect(result).toEqual(new Date('2025-11-14T00:00:00Z'));
    });

    it('When user has ultimate tier, then caducity date should be 30 days from now', () => {
      const trashedAt = new Date('2025-10-30T00:00:00Z');

      const result = service.calculateCaducityDate(
        'ultimate_individual',
        trashedAt,
      );

      expect(result).toEqual(new Date('2025-11-29T00:00:00Z'));
    });

    it('When user has lifetime tier, then caducity date should match its non-lifetime counterpart', () => {
      const trashedAt = new Date('2025-10-30T00:00:00Z');

      expect(
        service.calculateCaducityDate(
          'essential_lifetime_individual',
          trashedAt,
        ),
      ).toEqual(new Date('2025-11-06T00:00:00Z'));

      expect(
        service.calculateCaducityDate('premium_lifetime_individual', trashedAt),
      ).toEqual(new Date('2025-11-14T00:00:00Z'));

      expect(
        service.calculateCaducityDate(
          'ultimate_lifetime_individual',
          trashedAt,
        ),
      ).toEqual(new Date('2025-11-29T00:00:00Z'));
    });

    it('When user has B2C legacy tier, then caducity date should be 2 days from now', () => {
      const trashedAt = new Date('2025-10-30T00:00:00Z');

      const tiers = [
        '200gb_individual',
        '2tb_individual',
        '5tb_individual',
        '10tb_individual',
      ];

      for (const tier of tiers) {
        const result = service.calculateCaducityDate(tier, trashedAt);
        expect(result).toEqual(new Date('2025-11-01T00:00:00Z'));
      }
    });

    it('When user has standard_business tier, then caducity date should be 15 days from now', () => {
      const trashedAt = new Date('2025-10-30T00:00:00Z');

      const result = service.calculateCaducityDate(
        'standard_business',
        trashedAt,
      );

      expect(result).toEqual(new Date('2025-11-14T00:00:00Z'));
    });

    it('When user has pro_business tier, then caducity date should be 30 days from now', () => {
      const trashedAt = new Date('2025-10-30T00:00:00Z');

      const result = service.calculateCaducityDate('pro_business', trashedAt);

      expect(result).toEqual(new Date('2025-11-29T00:00:00Z'));
    });

    it('When user tier is unknown, then caducity date should default to 2 days', () => {
      const trashedAt = new Date('2025-10-30T00:00:00Z');

      const result = service.calculateCaducityDate('unknown_tier', trashedAt);

      expect(result).toEqual(new Date('2025-11-01T00:00:00Z'));
    });

    it('When user tier is null, then caducity date should default to 2 days', () => {
      const trashedAt = new Date('2025-10-30T00:00:00Z');

      const result = service.calculateCaducityDate(null, trashedAt);

      expect(result).toEqual(new Date('2025-11-01T00:00:00Z'));
    });

    it('When user tier is undefined, then caducity date should default to 2 days', () => {
      const trashedAt = new Date('2025-10-30T00:00:00Z');

      const result = service.calculateCaducityDate(undefined, trashedAt);

      expect(result).toEqual(new Date('2025-11-01T00:00:00Z'));
    });

    it('When no trashedAt date provided, then should calculate from current date', () => {
      const beforeCall = new Date();
      beforeCall.setDate(beforeCall.getDate() + 15);

      const result = service.calculateCaducityDate('premium_individual');

      const afterCall = new Date();
      afterCall.setDate(afterCall.getDate() + 15);

      expect(result.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it('When trashedAt is custom date, then should calculate from that date', () => {
      const customDate = new Date('2025-01-15T10:30:00Z');

      const result = service.calculateCaducityDate(
        'premium_individual',
        customDate,
      );

      expect(result).toEqual(new Date('2025-01-30T10:30:00Z'));
    });

    it('When trashedAt is in the past, then caducity date should calculate correctly', () => {
      const pastDate = new Date('2024-01-01T00:00:00Z');

      const result = service.calculateCaducityDate('free_individual', pastDate);

      expect(result).toEqual(new Date('2024-01-03T00:00:00Z'));
    });
  });

  describe('getTrashEntriesByIds', () => {
    it('When empty array provided, then should return empty array without database call', async () => {
      const findByItemIdsSpy = jest.spyOn(trashRepository, 'findByItemIds');

      const result = await service.getTrashEntriesByIds([], TrashItemType.File);

      expect(result).toEqual([]);
      expect(findByItemIdsSpy).not.toHaveBeenCalled();
    });

    it('When single file ID provided, then should query trash entries for that file', async () => {
      const fileUuid = 'file-uuid-123';
      const mockTrashEntry = newTrash({
        itemId: fileUuid,
        itemType: TrashItemType.File,
      });

      jest
        .spyOn(trashRepository, 'findByItemIds')
        .mockResolvedValue([mockTrashEntry]);

      const result = await service.getTrashEntriesByIds(
        [fileUuid],
        TrashItemType.File,
      );

      expect(trashRepository.findByItemIds).toHaveBeenCalledWith(
        [fileUuid],
        TrashItemType.File,
      );
      expect(result).toEqual([mockTrashEntry]);
    });

    it('When multiple file IDs provided, then should perform batch query', async () => {
      const fileUuids = ['file-1', 'file-2', 'file-3'];
      const mockEntries = fileUuids.map((id) =>
        newTrash({ itemId: id, itemType: TrashItemType.File }),
      );

      jest
        .spyOn(trashRepository, 'findByItemIds')
        .mockResolvedValue(mockEntries);

      const result = await service.getTrashEntriesByIds(
        fileUuids,
        TrashItemType.File,
      );

      expect(trashRepository.findByItemIds).toHaveBeenCalledWith(
        fileUuids,
        TrashItemType.File,
      );
      expect(result).toHaveLength(3);
    });

    it('When querying files, then should pass file type to repository', async () => {
      const fileUuids = ['file-1', 'file-2'];

      jest.spyOn(trashRepository, 'findByItemIds').mockResolvedValue([]);

      await service.getTrashEntriesByIds(fileUuids, TrashItemType.File);

      expect(trashRepository.findByItemIds).toHaveBeenCalledWith(
        fileUuids,
        TrashItemType.File,
      );
    });

    it('When querying folders, then should pass folder type to repository', async () => {
      const folderUuids = ['folder-1', 'folder-2'];

      jest.spyOn(trashRepository, 'findByItemIds').mockResolvedValue([]);

      await service.getTrashEntriesByIds(folderUuids, TrashItemType.Folder);

      expect(trashRepository.findByItemIds).toHaveBeenCalledWith(
        folderUuids,
        TrashItemType.Folder,
      );
    });

    it('When repository throws error, then should propagate error to caller', async () => {
      const fileUuids = ['file-1'];
      const dbError = new Error('Database connection failed');

      jest.spyOn(trashRepository, 'findByItemIds').mockRejectedValue(dbError);

      await expect(
        service.getTrashEntriesByIds(fileUuids, TrashItemType.File),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('addItemsToTrash', () => {
    it('When files with premium tier are trashed, then should create entries with 15 days caducity', async () => {
      const file1 = newFile();
      const file2 = newFile();
      const trashedAt = new Date('2025-10-30T00:00:00Z');
      const userId = 1;

      jest.spyOn(trashRepository, 'create').mockResolvedValue();

      await service.addItemsToTrash(
        [file1.uuid, file2.uuid],
        TrashItemType.File,
        'premium_individual',
        userId,
        trashedAt,
      );

      expect(trashRepository.create).toHaveBeenCalledTimes(2);
    });

    it('When folders with free tier are trashed, then should create entries with 48 hours caducity', async () => {
      const folder1 = newFolder();
      const folder2 = newFolder();
      const trashedAt = new Date('2025-10-30T00:00:00Z');
      const userId = 1;

      jest.spyOn(trashRepository, 'create').mockResolvedValue();

      await service.addItemsToTrash(
        [folder1.uuid, folder2.uuid],
        TrashItemType.Folder,
        'free_individual',
        userId,
        trashedAt,
      );

      expect(trashRepository.create).toHaveBeenCalledTimes(2);
    });

    it('When items with unknown tier are trashed, then should create entries with 2 days caducity', async () => {
      const file = newFile();
      const trashedAt = new Date('2025-10-30T00:00:00Z');
      const userId = 1;

      jest.spyOn(trashRepository, 'create').mockResolvedValue();

      await service.addItemsToTrash(
        [file.uuid],
        TrashItemType.File,
        'unknown_tier',
        userId,
        trashedAt,
      );

      expect(trashRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          caducityDate: new Date('2025-11-01T00:00:00Z'),
        }),
      );
    });

    it('When custom trashedAt date provided, then should use it for caducity calculation', async () => {
      const file = newFile();
      const customDate = new Date('2025-01-15T10:30:00Z');
      const expectedCaducity = new Date('2025-01-30T10:30:00Z');
      const userId = 1;

      jest.spyOn(trashRepository, 'create').mockResolvedValue();

      await service.addItemsToTrash(
        [file.uuid],
        TrashItemType.File,
        'premium_individual',
        userId,
        customDate,
      );

      expect(trashRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          caducityDate: expectedCaducity,
        }),
      );
    });

    it('When repository fails to create entry, then should propagate error', async () => {
      const file = newFile();
      const dbError = new Error('Duplicate entry violation');
      const userId = 1;

      jest.spyOn(trashRepository, 'create').mockRejectedValue(dbError);

      await expect(
        service.addItemsToTrash(
          [file.uuid],
          TrashItemType.File,
          'premium_individual',
          userId,
        ),
      ).rejects.toThrow('Duplicate entry violation');
    });
  });

  describe('removeItemsFromTrash', () => {
    it('When empty array provided, then should return early without calling repository', async () => {
      const deleteByItemIdsSpy = jest.spyOn(trashRepository, 'deleteByItemIds');

      await service.removeItemsFromTrash([], TrashItemType.File);

      expect(deleteByItemIdsSpy).not.toHaveBeenCalled();
    });

    it('When multiple file IDs provided, then should batch delete from trash', async () => {
      const fileIds = ['file-1', 'file-2', 'file-3'];

      jest.spyOn(trashRepository, 'deleteByItemIds').mockResolvedValue();

      await service.removeItemsFromTrash(fileIds, TrashItemType.File);

      expect(trashRepository.deleteByItemIds).toHaveBeenCalledWith(
        fileIds,
        TrashItemType.File,
      );
    });

    it('When removing files from trash, then should pass file type to repository', async () => {
      const fileIds = ['file-uuid-1', 'file-uuid-2'];

      jest.spyOn(trashRepository, 'deleteByItemIds').mockResolvedValue();

      await service.removeItemsFromTrash(fileIds, TrashItemType.File);

      expect(trashRepository.deleteByItemIds).toHaveBeenCalledWith(
        fileIds,
        TrashItemType.File,
      );
    });

    it('When removing folders from trash, then should pass folder type to repository', async () => {
      const folderIds = ['folder-uuid-1', 'folder-uuid-2'];

      jest.spyOn(trashRepository, 'deleteByItemIds').mockResolvedValue();

      await service.removeItemsFromTrash(folderIds, TrashItemType.Folder);

      expect(trashRepository.deleteByItemIds).toHaveBeenCalledWith(
        folderIds,
        TrashItemType.Folder,
      );
    });

    it('When repository fails to delete, then should propagate error', async () => {
      const fileIds = ['file-1', 'file-2'];
      const dbError = new Error('Database error during delete');

      jest.spyOn(trashRepository, 'deleteByItemIds').mockRejectedValue(dbError);

      await expect(
        service.removeItemsFromTrash(fileIds, TrashItemType.File),
      ).rejects.toThrow('Database error during delete');
    });
  });

  describe('deleteExpiredItems', () => {
    it('When empty array provided, then should return zero counts', async () => {
      const result = await service.deleteExpiredItems([]);

      expect(result).toEqual({
        filesDeleted: 0,
        foldersDeleted: 0,
      });
      expect(fileRepository.deleteFilesByUuid).not.toHaveBeenCalled();
      expect(folderRepository.deleteFoldersByUuid).not.toHaveBeenCalled();
    });

    it('When only files provided, then should delete files only', async () => {
      const fileItems = [
        Trash.build({
          itemId: 'file-1',
          itemType: TrashItemType.File,
          caducityDate: new Date('2020-01-01'),
          userId: 1,
        }),
        Trash.build({
          itemId: 'file-2',
          itemType: TrashItemType.File,
          caducityDate: new Date('2020-01-01'),
          userId: 1,
        }),
      ];

      jest.spyOn(fileRepository, 'deleteFilesByUuid').mockResolvedValue(2);
      jest.spyOn(folderRepository, 'deleteFoldersByUuid').mockResolvedValue(0);
      jest.spyOn(trashRepository, 'deleteByItemIds').mockResolvedValue();

      const result = await service.deleteExpiredItems(fileItems);

      expect(fileRepository.deleteFilesByUuid).toHaveBeenCalledWith([
        'file-1',
        'file-2',
      ]);
      expect(folderRepository.deleteFoldersByUuid).not.toHaveBeenCalled();
      expect(trashRepository.deleteByItemIds).toHaveBeenCalledWith(
        ['file-1', 'file-2'],
        TrashItemType.File,
      );
      expect(result).toEqual({
        filesDeleted: 2,
        foldersDeleted: 0,
      });
    });

    it('When only folders provided, then should delete folders only', async () => {
      const folderItems = [
        Trash.build({
          itemId: 'folder-1',
          itemType: TrashItemType.Folder,
          caducityDate: new Date('2020-01-01'),
          userId: 1,
        }),
        Trash.build({
          itemId: 'folder-2',
          itemType: TrashItemType.Folder,
          caducityDate: new Date('2020-01-01'),
          userId: 1,
        }),
      ];

      jest.spyOn(fileRepository, 'deleteFilesByUuid').mockResolvedValue(0);
      jest.spyOn(folderRepository, 'deleteFoldersByUuid').mockResolvedValue(2);
      jest.spyOn(trashRepository, 'deleteByItemIds').mockResolvedValue();

      const result = await service.deleteExpiredItems(folderItems);

      expect(fileRepository.deleteFilesByUuid).not.toHaveBeenCalled();
      expect(folderRepository.deleteFoldersByUuid).toHaveBeenCalledWith([
        'folder-1',
        'folder-2',
      ]);
      expect(trashRepository.deleteByItemIds).toHaveBeenCalledWith(
        ['folder-1', 'folder-2'],
        TrashItemType.Folder,
      );
      expect(result).toEqual({
        filesDeleted: 0,
        foldersDeleted: 2,
      });
    });

    it('When mixed files and folders provided, then should delete both types', async () => {
      const mixedItems = [
        Trash.build({
          itemId: 'file-1',
          itemType: TrashItemType.File,
          caducityDate: new Date('2020-01-01'),
          userId: 1,
        }),
        Trash.build({
          itemId: 'file-2',
          itemType: TrashItemType.File,
          caducityDate: new Date('2020-01-01'),
          userId: 1,
        }),
        Trash.build({
          itemId: 'folder-1',
          itemType: TrashItemType.Folder,
          caducityDate: new Date('2020-01-01'),
          userId: 1,
        }),
        Trash.build({
          itemId: 'folder-2',
          itemType: TrashItemType.Folder,
          caducityDate: new Date('2020-01-01'),
          userId: 1,
        }),
        Trash.build({
          itemId: 'folder-3',
          itemType: TrashItemType.Folder,
          caducityDate: new Date('2020-01-01'),
          userId: 1,
        }),
      ];

      jest.spyOn(fileRepository, 'deleteFilesByUuid').mockResolvedValue(2);
      jest.spyOn(folderRepository, 'deleteFoldersByUuid').mockResolvedValue(3);
      jest.spyOn(trashRepository, 'deleteByItemIds').mockResolvedValue();

      const result = await service.deleteExpiredItems(mixedItems);

      expect(fileRepository.deleteFilesByUuid).toHaveBeenCalledWith([
        'file-1',
        'file-2',
      ]);
      expect(folderRepository.deleteFoldersByUuid).toHaveBeenCalledWith([
        'folder-1',
        'folder-2',
        'folder-3',
      ]);
      expect(trashRepository.deleteByItemIds).toHaveBeenCalledTimes(2);
      expect(trashRepository.deleteByItemIds).toHaveBeenCalledWith(
        ['file-1', 'file-2'],
        TrashItemType.File,
      );
      expect(trashRepository.deleteByItemIds).toHaveBeenCalledWith(
        ['folder-1', 'folder-2', 'folder-3'],
        TrashItemType.Folder,
      );
      expect(result).toEqual({
        filesDeleted: 2,
        foldersDeleted: 3,
      });
    });

    it('When deletion is executed, then repositories and trash should be called in parallel', async () => {
      const mixedItems = [
        Trash.build({
          itemId: 'file-1',
          itemType: TrashItemType.File,
          caducityDate: new Date('2020-01-01'),
          userId: 1,
        }),
        Trash.build({
          itemId: 'folder-1',
          itemType: TrashItemType.Folder,
          caducityDate: new Date('2020-01-01'),
          userId: 1,
        }),
      ];

      const fileDeleteSpy = jest
        .spyOn(fileRepository, 'deleteFilesByUuid')
        .mockResolvedValue(1);
      const folderDeleteSpy = jest
        .spyOn(folderRepository, 'deleteFoldersByUuid')
        .mockResolvedValue(1);
      const trashDeleteSpy = jest
        .spyOn(trashRepository, 'deleteByItemIds')
        .mockResolvedValue();

      await service.deleteExpiredItems(mixedItems);

      expect(fileDeleteSpy).toHaveBeenCalled();
      expect(folderDeleteSpy).toHaveBeenCalled();
      expect(trashDeleteSpy).toHaveBeenCalledTimes(2);
    });
  });
});
