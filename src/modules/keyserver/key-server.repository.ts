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
  findUserKeys(userId: UserAttributes['id']): Promise<KeyServer[]>;
  findPublicKey(
    userId: UserAttributes['id'],
  ): Promise<KeyServerAttributes['publicKey']>;
  updateByUserAndEncryptVersion(
    userId: UserAttributes['id'],
    encryptVersion: KeyServerAttributes['encryptVersion'],
    data: Partial<KeyServerAttributes>,
  ): Promise<void>;
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

  findUserKeys(userId: UserAttributes['id']): Promise<KeyServer[]> {
    return this.model.findAll({
      where: { userId },
    });
  }

  async update(
    userId: UserAttributes['id'],
    data: Partial<KeyServerAttributes>,
  ) {
    await this.model.update(data, { where: { userId } });
  }

  async updateByUserAndEncryptVersion(
    userId: UserAttributes['id'],
    encryptVersion: KeyServerAttributes['encryptVersion'],
    data: Partial<KeyServerAttributes>,
  ): Promise<void> {
    await this.model.update(data, {
      where: { userId, encryptVersion },
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

  create(userId: UserAttributes['id'], data: Partial<KeyServerAttributes>) {
    return this.model.create({ userId, ...data });
  }
}
