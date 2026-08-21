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
  deleteInsideFoldersByUser(
    userId: Favorite['userId'],
    folderUuids: string[],
  ): Promise<void>;
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

  async deleteInsideFoldersByUser(
    userId: Favorite['userId'],
    folderUuids: string[],
  ): Promise<void> {
    await this.favoriteModel.sequelize.query(
      `
      DELETE FROM favorites
      WHERE user_id = :userId
        AND EXISTS (
          WITH RECURSIVE ancestors AS (
            SELECT fl1.uuid, fl1.parent_uuid, 1 AS depth
            FROM folders fl1
            WHERE fl1.uuid = CASE
              WHEN favorites.item_type = 'file' THEN (
                SELECT files.folder_uuid FROM files
                WHERE files.uuid = favorites.item_id
              )
              ELSE (
                SELECT folders.parent_uuid FROM folders
                WHERE folders.uuid = favorites.item_id
              )
            END

            UNION ALL

            SELECT fl2.uuid, fl2.parent_uuid, ancestors.depth + 1
            FROM folders fl2
            INNER JOIN ancestors ON fl2.uuid = ancestors.parent_uuid
            WHERE ancestors.depth < 100000
          )
          SELECT 1 FROM ancestors
          WHERE ancestors.uuid IN (:folderUuids)
        )
      `,
      {
        replacements: { userId, folderUuids },
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
