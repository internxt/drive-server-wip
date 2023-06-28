import { Injectable, Logger } from '@nestjs/common';
import { LookUp, LookUpAttributes } from './look-up.domain';
import { InjectModel } from '@nestjs/sequelize';
import { LookUpModel } from './look-up.model';
import { UserAttributes } from '../user/user.attributes';

export interface LookUpRepository {
  search(
    userUuid: UserAttributes['uuid'],
    partialName: string,
    offset: number,
  ): Promise<Array<LookUpAttributes>>;

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
    offset: number,
  ): Promise<Array<LookUpAttributes>> {
    const query = `
      SELECT
        *,
        rank_name,
        similarity
      FROM
        look_up as lu,
        to_tsvector(lu."name") document,
        to_tsquery('${partialName}') query,
        nullif (ts_rank(to_tsvector(lu."name"), query), 0) rank_name,
        SIMILARITY('${partialName}', lu."name") similarity
      WHERE query @@ document or similarity > 0 and lu."user_uuid" = '${userUuid}'
      ORDER BY rank_name, similarity desc  nulls  last
      LIMIT 10 OFFSET ${offset} 
  `;
    const result = await this.model.sequelize.query(query);

    return result[0] as Array<LookUpAttributes>;
  }

  async instert(entry: LookUp): Promise<void> {
    await this.model.create({
      id: entry.id,
      name: entry.name,
      userUuid: entry.userUuid,
    });
  }
}
