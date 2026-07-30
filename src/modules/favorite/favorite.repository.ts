import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes } from 'sequelize';
import { FavoriteModel } from './favorite.model';
import { Favorite } from './favorite.domain';

interface FavoriteRepository {
  create(
    userId: Favorite['userId'],
    itemId: Favorite['itemId'],
    itemType: Favorite['itemType'],
  ): Promise<Favorite>;
  delete(
    userId: Favorite['userId'],
    itemId: Favorite['itemId'],
    itemType: Favorite['itemType'],
  ): Promise<void>;
  bulkDelete(
    userId: Favorite['userId'],
    itemIds: Favorite['itemId'][],
    itemType: Favorite['itemType'],
  ): Promise<void>;
  existsForUser(
    userId: Favorite['userId'],
    itemId: Favorite['itemId'],
    itemType: Favorite['itemType'],
  ): Promise<boolean>;
  deleteOrphanedByUser(userId: Favorite['userId']): Promise<void>;
}

@Injectable()
export class SequelizeFavoriteRepository implements FavoriteRepository {
  constructor(
    @InjectModel(FavoriteModel)
    private readonly favoriteModel: typeof FavoriteModel,
  ) {}

  async create(
    userId: Favorite['userId'],
    itemId: Favorite['itemId'],
    itemType: Favorite['itemType'],
  ): Promise<Favorite> {
    const [favorite] = await this.favoriteModel.findOrCreate({
      where: { userId, itemId, itemType },
      defaults: { userId, itemId, itemType },
    });
    return this.toDomain(favorite);
  }

  async delete(
    userId: Favorite['userId'],
    itemId: Favorite['itemId'],
    itemType: Favorite['itemType'],
  ): Promise<void> {
    await this.favoriteModel.destroy({
      where: { userId, itemId, itemType },
    });
  }

  async bulkDelete(
    userId: Favorite['userId'],
    itemIds: Favorite['itemId'][],
    itemType: Favorite['itemType'],
  ): Promise<void> {
    await this.favoriteModel.destroy({
      where: {
        userId,
        itemType,
        itemId: { [Op.in]: itemIds },
      },
    });
  }

  async existsForUser(
    userId: Favorite['userId'],
    itemId: Favorite['itemId'],
    itemType: Favorite['itemType'],
  ): Promise<boolean> {
    const count = await this.favoriteModel.count({
      where: { userId, itemId, itemType },
    });
    return count > 0;
  }

  async deleteOrphanedByUser(userId: Favorite['userId']): Promise<void> {
    await this.favoriteModel.sequelize.query(
      `
      DELETE FROM favorites
      WHERE user_id = :userId
        AND (
          (item_type = 'file' AND EXISTS (
            SELECT 1 FROM files
            WHERE files.uuid = favorites.item_id AND files.status = 'DELETED'
          ))
          OR
          (item_type = 'folder' AND EXISTS (
            SELECT 1 FROM folders
            WHERE folders.uuid = favorites.item_id AND folders.removed = true
          ))
        )
      `,
      {
        replacements: { userId },
        type: QueryTypes.DELETE,
      },
    );
  }

  private toDomain(model: FavoriteModel): Favorite {
    return Favorite.build({
      id: model.id,
      userId: model.userId,
      itemId: model.itemId,
      itemType: model.itemType,
      createdAt: model.createdAt,
    });
  }
}
