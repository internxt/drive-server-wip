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
    const MAX_DEPTH = 10000;

    await this.favoriteModel.sequelize.query(
      `
      WITH RECURSIVE subtree AS (
        SELECT fl1.uuid, 1 AS depth, ARRAY[fl1.uuid] AS path
        FROM folders fl1
        WHERE fl1.uuid IN (:folderUuids)

        UNION ALL

        SELECT fl2.uuid, subtree.depth + 1, subtree.path || fl2.uuid
        FROM folders fl2
        INNER JOIN subtree ON fl2.parent_uuid = subtree.uuid
        WHERE subtree.depth < :maxDepth
          AND NOT fl2.uuid = ANY(subtree.path)
      )
      DELETE FROM favorites
      WHERE user_id = :userId
        AND (
          (favorites.item_type = 'folder' AND EXISTS (
            SELECT 1 FROM folders
            WHERE folders.uuid = favorites.item_id
              AND folders.parent_uuid IN (SELECT uuid FROM subtree)
          ))
          OR
          (favorites.item_type = 'file' AND EXISTS (
            SELECT 1 FROM files
            WHERE files.uuid = favorites.item_id
              AND files.folder_uuid IN (SELECT uuid FROM subtree)
          ))
        )
      `,
      {
        replacements: { userId, folderUuids, maxDepth: MAX_DEPTH },
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
