import { createMock } from '@golevelup/ts-jest';
import { SequelizeTrashRepository } from './trash.repository';
import { type TrashModel } from './trash.model';
import { TrashItemType } from './trash.attributes';
import { newTrash } from '../../../test/fixtures';

describe('SequelizeTrashRepository', () => {
  let repository: SequelizeTrashRepository;
  let trashModel: typeof TrashModel;

  beforeEach(() => {
    trashModel = createMock<typeof TrashModel>();
    repository = new SequelizeTrashRepository(trashModel);
  });

  describe('findByItemIds', () => {
    it('When item IDs provided, then should query database with IN clause', async () => {
      const itemIds = ['uuid-1', 'uuid-2', 'uuid-3'];
      const mockEntries = itemIds.map((id) =>
        newTrash({ itemId: id, itemType: TrashItemType.File }),
      );

      jest.spyOn(trashModel, 'findAll').mockResolvedValue(mockEntries as any);

      await repository.findByItemIds(itemIds, TrashItemType.File);

      expect(trashModel.findAll).toHaveBeenCalledWith({
        where: {
          itemId: { [Symbol.for('in')]: itemIds },
          itemType: TrashItemType.File,
        },
      });
    });

    it('When single item ID provided, then should return single result', async () => {
      const itemId = 'single-uuid';
      const mockEntry = newTrash({
        itemId,
        itemType: TrashItemType.File,
      });

      jest.spyOn(trashModel, 'findAll').mockResolvedValue([mockEntry] as any);

      const result = await repository.findByItemIds(
        [itemId],
        TrashItemType.File,
      );

      expect(result).toHaveLength(1);
      expect(result[0].itemId).toBe(itemId);
    });

    it('When querying files, then should filter by file type', async () => {
      const itemIds = ['file-1', 'file-2'];

      jest.spyOn(trashModel, 'findAll').mockResolvedValue([]);

      await repository.findByItemIds(itemIds, TrashItemType.File);

      expect(trashModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            itemType: TrashItemType.File,
          }),
        }),
      );
    });

    it('When querying folders, then should filter by folder type', async () => {
      const itemIds = ['folder-1', 'folder-2'];

      jest.spyOn(trashModel, 'findAll').mockResolvedValue([]);

      await repository.findByItemIds(itemIds, TrashItemType.Folder);

      expect(trashModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            itemType: TrashItemType.Folder,
          }),
        }),
      );
    });

    it('When no matches found in database, then should return empty array', async () => {
      const itemIds = ['non-existent-1', 'non-existent-2'];

      jest.spyOn(trashModel, 'findAll').mockResolvedValue([]);

      const result = await repository.findByItemIds(
        itemIds,
        TrashItemType.File,
      );

      expect(result).toEqual([]);
    });

    it('When multiple items match, then should return all entries', async () => {
      const itemIds = ['uuid-1', 'uuid-2', 'uuid-3'];
      const mockEntries = itemIds.map((id) =>
        newTrash({ itemId: id, itemType: TrashItemType.File }),
      );

      jest.spyOn(trashModel, 'findAll').mockResolvedValue(mockEntries as any);

      const result = await repository.findByItemIds(
        itemIds,
        TrashItemType.File,
      );

      expect(result).toHaveLength(3);
      expect(result.map((e) => e.itemId)).toEqual(itemIds);
    });

    it('When database throws error, then should propagate error', async () => {
      const itemIds = ['uuid-1'];
      const dbError = new Error('Database connection lost');

      jest.spyOn(trashModel, 'findAll').mockRejectedValue(dbError);

      await expect(
        repository.findByItemIds(itemIds, TrashItemType.File),
      ).rejects.toThrow('Database connection lost');
    });
  });

  describe('create', () => {
    it('When valid trash entry provided, then should upsert entry in database', async () => {
      const trashEntry = newTrash({
        itemId: 'file-uuid',
        itemType: TrashItemType.File,
        caducityDate: new Date('2025-11-13T00:00:00Z'),
      });

      jest.spyOn(trashModel, 'upsert').mockResolvedValue([null, null]);

      await repository.create(trashEntry);

      expect(trashModel.upsert).toHaveBeenCalledWith({
        itemId: trashEntry.itemId,
        itemType: trashEntry.itemType,
        caducityDate: trashEntry.caducityDate,
        userId: trashEntry.userId,
      });
    });

    it('When file entry created, then should upsert with file type', async () => {
      const fileEntry = newTrash({
        itemId: 'file-uuid',
        itemType: TrashItemType.File,
      });

      jest.spyOn(trashModel, 'upsert').mockResolvedValue([null, null]);

      await repository.create(fileEntry);

      expect(trashModel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          itemType: TrashItemType.File,
        }),
      );
    });

    it('When folder entry created, then should upsert with folder type', async () => {
      const folderEntry = newTrash({
        itemId: 'folder-uuid',
        itemType: TrashItemType.Folder,
      });

      jest.spyOn(trashModel, 'upsert').mockResolvedValue([null, null]);

      await repository.create(folderEntry);

      expect(trashModel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          itemType: TrashItemType.Folder,
        }),
      );
    });

    it('When null caducity date provided, then should upsert entry with null', async () => {
      const entryWithNullCaducity = newTrash({
        itemId: 'file-uuid',
        itemType: TrashItemType.File,
      });
      entryWithNullCaducity.caducityDate = null;

      jest.spyOn(trashModel, 'upsert').mockResolvedValue([null, null]);

      await repository.create(entryWithNullCaducity);

      expect(trashModel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          caducityDate: null,
        }),
      );
    });

    it('When database throws error, then should propagate error', async () => {
      const trashEntry = newTrash();
      const dbError = new Error('Database error');

      jest.spyOn(trashModel, 'upsert').mockRejectedValue(dbError);

      await expect(repository.create(trashEntry)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('delete', () => {
    it('When item exists, then should delete entry from database', async () => {
      const itemId = 'file-uuid-to-delete';

      jest.spyOn(trashModel, 'destroy').mockResolvedValue(1);

      await repository.delete(itemId, TrashItemType.File);

      expect(trashModel.destroy).toHaveBeenCalledWith({
        where: {
          itemId: itemId,
          itemType: TrashItemType.File,
        },
      });
    });

    it('When deleting file entry, then should filter by file type', async () => {
      const fileUuid = 'file-uuid';

      jest.spyOn(trashModel, 'destroy').mockResolvedValue(1);

      await repository.delete(fileUuid, TrashItemType.File);

      expect(trashModel.destroy).toHaveBeenCalledWith({
        where: {
          itemId: fileUuid,
          itemType: TrashItemType.File,
        },
      });
    });

    it('When deleting folder entry, then should filter by folder type', async () => {
      const folderUuid = 'folder-uuid';

      jest.spyOn(trashModel, 'destroy').mockResolvedValue(1);

      await repository.delete(folderUuid, TrashItemType.Folder);

      expect(trashModel.destroy).toHaveBeenCalledWith({
        where: {
          itemId: folderUuid,
          itemType: TrashItemType.Folder,
        },
      });
    });

    it('When item not found in database, then should complete without error', async () => {
      const nonExistentUuid = 'non-existent-uuid';

      jest.spyOn(trashModel, 'destroy').mockResolvedValue(0);

      await expect(
        repository.delete(nonExistentUuid, TrashItemType.File),
      ).resolves.not.toThrow();
    });

    it('When database throws error, then should propagate error', async () => {
      const itemId = 'file-uuid';
      const dbError = new Error('Database error during delete');

      jest.spyOn(trashModel, 'destroy').mockRejectedValue(dbError);

      await expect(
        repository.delete(itemId, TrashItemType.File),
      ).rejects.toThrow('Database error during delete');
    });
  });

  describe('findExpiredItems', () => {
    it('When expired items exist, then it should return them', async () => {
      const limit = 10;
      const now = new Date();
      const expiredDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const mockTrashItems = [
        newTrash({
          itemId: 'file-1',
          itemType: TrashItemType.File,
          caducityDate: expiredDate,
          userId: 1,
        }),
        newTrash({
          itemId: 'folder-1',
          itemType: TrashItemType.Folder,
          caducityDate: expiredDate,
          userId: 1,
        }),
      ];

      jest
        .spyOn(trashModel, 'findAll')
        .mockResolvedValue(mockTrashItems as any);

      const result = await repository.findExpiredItems(limit);

      expect(trashModel.findAll).toHaveBeenCalledWith({
        where: {
          caducityDate: {
            [Symbol.for('lte')]: expect.any(Date),
          },
        },
        limit,
      });
      expect(result).toHaveLength(2);
      expect(result[0].itemId).toBe('file-1');
      expect(result[1].itemId).toBe('folder-1');
    });

    it('When limit is set, then it should respect the limit', async () => {
      const limit = 5;

      jest.spyOn(trashModel, 'findAll').mockResolvedValue([]);

      await repository.findExpiredItems(limit);

      expect(trashModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
        }),
      );
    });

    it('When no expired items found, then it should return empty array', async () => {
      const limit = 10;

      jest.spyOn(trashModel, 'findAll').mockResolvedValue([]);

      const result = await repository.findExpiredItems(limit);

      expect(result).toEqual([]);
    });

    it('When mixed file and folder items are expired, then it should return both types', async () => {
      const limit = 100;
      const expiredDate = new Date('2020-01-01');

      const mockTrashItems = [
        newTrash({
          itemId: 'file-1',
          itemType: TrashItemType.File,
          caducityDate: expiredDate,
        }),
        newTrash({
          itemId: 'file-2',
          itemType: TrashItemType.File,
          caducityDate: expiredDate,
        }),
        newTrash({
          itemId: 'folder-1',
          itemType: TrashItemType.Folder,
          caducityDate: expiredDate,
        }),
      ];

      jest
        .spyOn(trashModel, 'findAll')
        .mockResolvedValue(mockTrashItems as any);

      const result = await repository.findExpiredItems(limit);

      expect(result).toHaveLength(3);
      expect(
        result.filter((t) => t.itemType === TrashItemType.File),
      ).toHaveLength(2);
      expect(
        result.filter((t) => t.itemType === TrashItemType.Folder),
      ).toHaveLength(1);
    });
  });
});
