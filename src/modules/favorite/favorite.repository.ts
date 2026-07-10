import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
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
