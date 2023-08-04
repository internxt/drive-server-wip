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
  findPublicKey(
    userId: UserAttributes['id'],
  ): Promise<KeyServerAttributes['publicKey']>;
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

  async findPublicKey(
    userId: UserAttributes['id'],
  ): Promise<KeyServerAttributes['publicKey']> {
    const keyServer = await this.model.findOne({ where: { userId } });
    return keyServer.publicKey;
  }

  async deleteByUserId(userId: UserAttributes['id']): Promise<void> {
    await this.model.destroy({ where: { userId } });
  }
}
