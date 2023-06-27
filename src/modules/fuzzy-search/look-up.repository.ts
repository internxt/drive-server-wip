import { Injectable } from '@nestjs/common';
import { LookUpAttributes } from './look-up.domain';
import { InjectModel } from '@nestjs/sequelize';
import { LookUpModel } from './look-up.model';
import { fn } from 'sequelize';
import { UserAttributes } from '../user/user.attributes';

export interface LookUpRepository {
  search(
    userUuid: UserAttributes['uuid'],
    partialName: string,
  ): Promise<Array<LookUpAttributes>>;
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
  ): Promise<Array<LookUpAttributes>> {
    const items = await this.model.findAll({
      where: {
        userUuid,
        name: fn('to_tsvector', partialName),
      },
    });

    return items;
  }
}
