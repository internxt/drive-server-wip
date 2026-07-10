import { v4 } from 'uuid';
import { newFavorite, newUser } from '../../../test/fixtures';
import { Favorite, FavoriteItemType } from './favorite.domain';

describe('Favorite Domain', () => {
  describe('build', () => {
    it('When built from attributes, then it returns a Favorite instance with those attributes', () => {
      const id = v4();
      const userId = v4();
      const itemId = v4();
      const createdAt = new Date();

      const favorite = Favorite.build({
        id,
        userId,
        itemId,
        itemType: FavoriteItemType.Folder,
        createdAt,
      });

      expect(favorite).toBeInstanceOf(Favorite);
      expect(favorite).toMatchObject({
        id,
        userId,
        itemId,
        itemType: FavoriteItemType.Folder,
        createdAt,
      });
    });
  });

  describe('isOwnedBy', () => {
    it('When the favorite belongs to the user, then it returns true', () => {
      const user = newUser();
      const favorite = newFavorite({ userId: user.uuid });

      expect(favorite.isOwnedBy(user)).toBe(true);
    });

    it('When the favorite does not belong to the user, then it returns false', () => {
      const user = newUser();
      const favorite = newFavorite({ userId: v4() });

      expect(favorite.isOwnedBy(user)).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('When serialized, then it returns a plain object with the favorite attributes', () => {
      const favorite = newFavorite({ itemType: FavoriteItemType.File });

      expect(favorite.toJSON()).toEqual({
        id: favorite.id,
        userId: favorite.userId,
        itemId: favorite.itemId,
        itemType: favorite.itemType,
        createdAt: favorite.createdAt,
      });
    });
  });
});
