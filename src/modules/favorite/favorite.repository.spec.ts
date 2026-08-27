import { Test, type TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { createMock } from '@golevelup/ts-jest';
import { Op, QueryTypes } from 'sequelize';
import { v4 } from 'uuid';
import { SequelizeFavoriteRepository } from './favorite.repository';
import { FavoriteModel } from './favorite.model';
import { Favorite, FavoriteItemType } from './favorite.domain';
import { newFavorite } from '../../../test/fixtures';

describe('SequelizeFavoriteRepository', () => {
  let repository: SequelizeFavoriteRepository;
  let favoriteModel: typeof FavoriteModel;

  const userId = v4();
  const itemId = v4();
  const itemType = FavoriteItemType.File;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizeFavoriteRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get<SequelizeFavoriteRepository>(
      SequelizeFavoriteRepository,
    );
    favoriteModel = module.get<typeof FavoriteModel>(
      getModelToken(FavoriteModel),
    );
  });

  describe('create', () => {
    it('When the item is not favorited yet, then it creates and returns the favorite', async () => {
      const mockFavorite = newFavorite({ userId, itemId, itemType });
      jest
        .spyOn(favoriteModel, 'findOrCreate')
        .mockResolvedValueOnce([mockFavorite as any, true]);

      const result = await repository.create(userId, itemId, itemType);

      expect(favoriteModel.findOrCreate).toHaveBeenCalledWith({
        where: { userId, itemId, itemType },
        defaults: { userId, itemId, itemType },
      });
      expect(result).toBeInstanceOf(Favorite);
      expect(result).toMatchObject({ userId, itemId, itemType });
    });

    it('When the item is already favorited, then it is idempotent and returns the existing favorite', async () => {
      const mockFavorite = newFavorite({ userId, itemId, itemType });
      jest
        .spyOn(favoriteModel, 'findOrCreate')
        .mockResolvedValueOnce([mockFavorite as any, false]);

      const result = await repository.create(userId, itemId, itemType);

      expect(result).toMatchObject({ userId, itemId, itemType });
    });
  });

  describe('delete', () => {
    it('When called, then it destroys the matching favorite row', async () => {
      jest.spyOn(favoriteModel, 'destroy').mockResolvedValueOnce(1);

      await repository.delete(userId, itemId, itemType);

      expect(favoriteModel.destroy).toHaveBeenCalledWith({
        where: { userId, itemId, itemType },
      });
    });

    it('When there is nothing to delete, then it does not throw', async () => {
      jest.spyOn(favoriteModel, 'destroy').mockResolvedValueOnce(0);

      await expect(
        repository.delete(userId, itemId, itemType),
      ).resolves.not.toThrow();
    });
  });

  describe('bulkDelete', () => {
    it('When called with multiple item ids, then it destroys all matching favorite rows', async () => {
      const itemIds = [v4(), v4(), v4()];
      jest.spyOn(favoriteModel, 'destroy').mockResolvedValueOnce(3);

      await repository.bulkDelete(userId, itemIds, itemType);

      expect(favoriteModel.destroy).toHaveBeenCalledWith({
        where: {
          userId,
          itemType,
          itemId: { [Op.in]: itemIds },
        },
      });
    });
  });

  describe('existsForUser', () => {
    it('When the favorite exists, then it returns true', async () => {
      jest.spyOn(favoriteModel, 'count').mockResolvedValueOnce(1);

      const result = await repository.existsForUser(userId, itemId, itemType);

      expect(favoriteModel.count).toHaveBeenCalledWith({
        where: { userId, itemId, itemType },
      });
      expect(result).toBe(true);
    });

    it('When the favorite does not exist, then it returns false', async () => {
      jest.spyOn(favoriteModel, 'count').mockResolvedValueOnce(0);

      const result = await repository.existsForUser(userId, itemId, itemType);

      expect(result).toBe(false);
    });
  });

  describe('deleteOrphanedByUser', () => {
    it('When called, then it deletes the favorites pointing to removed items of the user', async () => {
      const querySpy = jest
        .spyOn(favoriteModel.sequelize, 'query')
        .mockResolvedValueOnce(undefined);

      await repository.deleteOrphanedByUser(userId);

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM favorites'),
        {
          replacements: { userId },
          type: QueryTypes.DELETE,
        },
      );
    });
  });

  describe('deleteInsideFoldersByUser', () => {
    it('When called, then it deletes the favorites of the user under the given folders', async () => {
      const folderUuids = [v4(), v4()];
      const querySpy = jest
        .spyOn(favoriteModel.sequelize, 'query')
        .mockResolvedValueOnce(undefined);

      await repository.deleteInsideFoldersByUser(userId, folderUuids);

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM favorites'),
        {
          replacements: { userId, folderUuids, maxDepth: 10000 },
          type: QueryTypes.DELETE,
        },
      );
    });

    it('When called, then it resolves the deleted folders subtree once instead of per favorite', async () => {
      const folderUuids = [v4()];
      const querySpy = jest
        .spyOn(favoriteModel.sequelize, 'query')
        .mockResolvedValueOnce(undefined);

      await repository.deleteInsideFoldersByUser(userId, folderUuids);

      const [query] = querySpy.mock.calls[0];

      expect(query).toEqual(
        expect.stringContaining('INNER JOIN subtree ON fl2.parent_uuid'),
      );
      expect(query).not.toEqual(
        expect.stringContaining('INNER JOIN ancestors'),
      );
    });

    it('When called, then it caps the recursion depth and guards against cycles', async () => {
      const folderUuids = [v4()];
      const querySpy = jest
        .spyOn(favoriteModel.sequelize, 'query')
        .mockResolvedValueOnce(undefined);

      await repository.deleteInsideFoldersByUser(userId, folderUuids);

      const [query] = querySpy.mock.calls[0];

      expect(query).toEqual(
        expect.stringContaining('subtree.depth < :maxDepth'),
      );
      expect(query).toEqual(
        expect.stringContaining('NOT fl2.uuid = ANY(subtree.path)'),
      );
    });
  });
});
