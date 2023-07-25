import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UserAttributes } from '../user/user.attributes';
import { KeyServer, KeyServerAttributes } from './key-server.domain';
import { KeyServerModel } from './key-server.model';

interface KeyServerRepository {
  findUserKeysOrCreate(
    userId: UserAttributes['id'],
    data: Partial<KeyServerAttributes>,
  ): Promise<[KeyServer | null, boolean]>;
  deleteByUserId(userId: UserAttributes['id']): Promise<void>;
}

@Injectable()
export class SequelizeKeyServerRepository implements KeyServerRepository {
  constructor(
    @InjectModel(KeyServerModel)
    private model: typeof KeyServerModel,
  ) {}

  findUserKeysOrCreate(
    userId: UserAttributes['id'],
    data: Partial<KeyServerAttributes>,
  ): Promise<[KeyServer | null, boolean]> {
    return this.model.findOrCreate({
      where: { userId },
      defaults: data,
    });
  }

  async deleteByUserId(userId: UserAttributes['id']): Promise<void> {
    await this.model.destroy({ where: { userId } });
  }
}
