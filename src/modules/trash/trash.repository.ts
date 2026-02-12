import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { TrashModel } from './trash.model';
import { Trash } from './trash.domain';
import { TrashItemType } from './trash.attributes';
import { Op } from 'sequelize';

interface TrashRepository {
  create(trash: Trash): Promise<void>;
  delete(itemId: string, itemType: TrashItemType): Promise<void>;
  deleteByItemIds(itemIds: string[], itemType: TrashItemType): Promise<void>;
  deleteByUserId(userId: number, limit?: number): Promise<number>;
  findByItemIds(itemIds: string[], itemType: TrashItemType): Promise<Trash[]>;
  findExpiredItems(limit: number): Promise<Trash[]>;
}

@Injectable()
export class SequelizeTrashRepository implements TrashRepository {
  constructor(
    @InjectModel(TrashModel)
    private readonly model: typeof TrashModel,
  ) {}

  async create(trash: Trash): Promise<void> {
    await this.model.upsert({
      itemId: trash.itemId,
      itemType: trash.itemType,
      caducityDate: trash.caducityDate,
      userId: trash.userId,
    });
  }

  async delete(itemId: string, itemType: TrashItemType): Promise<void> {
    await this.model.destroy({
      where: {
        itemId,
        itemType,
      },
    });
  }

  async deleteByItemIds(
    itemIds: string[],
    itemType: TrashItemType,
  ): Promise<void> {
    await this.model.destroy({
      where: {
        itemId: {
          [Op.in]: itemIds,
        },
        itemType,
      },
    });
  }

  async findByItemIds(
    itemIds: string[],
    itemType: TrashItemType,
  ): Promise<Trash[]> {
    if (itemIds.length === 0) {
      return [];
    }

    const results = await this.model.findAll({
      where: {
        itemId: {
          [Op.in]: itemIds,
        },
        itemType,
      },
    });

    return results.map((result) =>
      Trash.build({
        itemId: result.itemId,
        itemType: result.itemType,
        caducityDate: result.caducityDate,
        userId: result.userId,
      }),
    );
  }

  async deleteByUserId(userId: number, limit?: number): Promise<number> {
    const result = await this.model.destroy({
      where: { userId },
      limit,
    });

    return result;
  }

  async findExpiredItems(limit: number): Promise<Trash[]> {
    const results = await this.model.findAll({
      where: {
        caducityDate: {
          [Op.lte]: new Date(),
        },
      },
      limit,
    });

    return results.map((result) =>
      Trash.build({
        itemId: result.itemId,
        itemType: result.itemType,
        caducityDate: result.caducityDate,
        userId: result.userId,
      }),
    );
  }
}
