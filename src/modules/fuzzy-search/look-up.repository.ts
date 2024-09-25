import { Injectable } from '@nestjs/common';
import { ItemType, LookUp } from './look-up.domain';
import { InjectModel } from '@nestjs/sequelize';
import { LookUpModel } from './look-up.model';
import { UserAttributes } from '../user/user.attributes';
import { Sequelize } from 'sequelize';
import { Op } from 'sequelize';
import { FolderModel } from '../folder/folder.model';
import { FileModel } from '../file/file.model';

type LookUpResult = Array<{
  id: string;
  itemId: string;
  itemType: ItemType;
  userId: string;
  name: string;
  rank: number | null;
  similarity: number;
}>;

export interface LookUpRepository {
  search(
    userUuid: UserAttributes['uuid'],
    partialName: string,
    offset: number,
  ): Promise<LookUpResult>;

  instert(entry: LookUp): Promise<void>;
}

@Injectable()
export class SequelizeLookUpRepository implements LookUpRepository {
  constructor(
    @InjectModel(LookUpModel)
    private model: typeof LookUpModel,
  ) {}

  async search(
    userUuid: UserAttributes['uuid'],
    partialName: string,
    offset = 0,
  ): Promise<LookUpResult> {
    const result = await this.model.findAll({
      attributes: {
        include: [
          [
            Sequelize.literal(
              'nullif(ts_rank("tokenized_name", to_tsquery(:partialName)), 1)',
            ),
            'rank',
          ],
          [
            Sequelize.fn(
              'similarity',
              Sequelize.col('LookUpModel.name'),
              partialName,
            ),
            'similarity',
          ],
          [
            Sequelize.literal(
              `CASE WHEN "LookUpModel"."name" = :partialName THEN 1 ELSE 0 END`,
            ),
            'exactMatch',
          ],
        ],
      },
      where: {
        user_id: userUuid,
        [Op.or]: [
          Sequelize.literal(`to_tsquery(:partialName) @@ "tokenized_name"`),
          Sequelize.where(
            Sequelize.fn(
              'similarity',
              Sequelize.col('LookUpModel.name'),
              partialName,
            ),
            { [Op.gt]: 0.0 },
          ),
        ],
      },
      order: [
        [Sequelize.literal('"exactMatch"'), 'DESC'], // Prioritize exact matches
        [Sequelize.literal('"rank"'), 'DESC'],
        [Sequelize.literal('"similarity"'), 'DESC'],
      ],
      limit: 5,
      offset: offset,
      replacements: { partialName, userUuid },
      include: [
        {
          model: FileModel,
          attributes: ['type', 'id', 'size', 'bucket', 'fileId', 'plainName'],
          as: 'file',
        },
        {
          model: FolderModel,
          attributes: ['id'],
          as: 'folder',
        },
      ],
    });

    return result.map((index) => {
      const raw = index.toJSON();
      const base = {
        id: raw.id,
        itemId: raw.itemId,
        itemType: raw.itemType,
        userId: raw.userId,
        name: raw.name,
        rank: raw.rank,
        similarity: raw.similarity,
      };
      if (raw.file) {
        return { ...base, item: raw.file };
      } else if (raw.folder) {
        return { ...base, item: raw.folder };
      } else {
        return { ...base };
      }
    });
  }

  async instert(entry: LookUp): Promise<void> {
    await this.model.create({
      id: entry.itemId,
      name: entry.name,
      userUuid: entry.userId,
    });
  }
}
