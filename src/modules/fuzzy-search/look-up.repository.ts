import { Injectable } from '@nestjs/common';
import { ItemType, LookUp } from './look-up.domain';
import { InjectModel } from '@nestjs/sequelize';
import { LookUpModel } from './look-up.model';
import { UserAttributes } from '../user/user.attributes';

type LookUpResult = Array<{
  id: string;
  itemUuid: string;
  itemType: ItemType;
  userUuid: string;
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
    const query = `
      SELECT
        *
      FROM
        look_up as lu,
        to_tsquery(:partialName) query,
        nullif (ts_rank(lu."tokenized_name", query), 0) rank,
        SIMILARITY(:partialName, lu."name") similarity
      WHERE  query @@ lu."tokenized_name" or similarity > 0
      ORDER BY rank, similarity desc  nulls  last
      LIMIT 5 OFFSET :offset
  `;

    const result = await this.model.sequelize.query(query, {
      replacements: { partialName, offset, userUuid },
    });

    return result[0].map((raw: any) => ({
      id: raw.id,
      itemUuid: raw.item_uuid,
      itemType: raw.item_type,
      userUuid: raw.user_uuid,
      name: raw.name,
      rank: raw.rank,
      similarity: raw.similarity,
    }));
  }

  async instert(entry: LookUp): Promise<void> {
    await this.model.create({
      id: entry.itemUuid,
      name: entry.name,
      userUuid: entry.userUuid,
    });
  }
}
