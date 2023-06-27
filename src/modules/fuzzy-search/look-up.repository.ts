import { Injectable } from '@nestjs/common';
import { LookUp, LookUpAttributes } from './look-up.domain';
import { InjectModel } from '@nestjs/sequelize';
import { LookUpModel } from './look-up.model';
import { fn } from 'sequelize';
import { UserAttributes } from '../user/user.attributes';

export interface LookUpRepository {
  search(
    userUuid: UserAttributes['uuid'],
    partialName: string,
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
  ): Promise<Array<LookUpAttributes>> {
    const items = await this.model.findAll({
      where: {
        userUuid,
        name: fn('to_tsquery', partialName),
      },
    });

    return items;
  }

  async instert(entry: LookUp): Promise<void> {
    await this.model.create({
      id: entry.id,
      name: entry.name,
      userUuid: entry.userUuid,
    });
  }
}
