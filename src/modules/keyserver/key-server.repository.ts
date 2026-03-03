import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { type UserAttributes } from '../user/user.attributes';
import { KeyServer, type KeyServerAttributes } from './key-server.domain';
import { KeyServerModel } from './key-server.model';

@Injectable()
export class SequelizeKeyServerRepository {
  constructor(
    @InjectModel(KeyServerModel)
    private readonly model: typeof KeyServerModel,
  ) {}

  async findUserKeysOrCreate(
    userId: UserAttributes['id'],
    data: Partial<KeyServerAttributes>,
  ): Promise<[KeyServer | null, boolean]> {
    const optionalWhere = {};

    if (data.encryptVersion) {
      optionalWhere['encryptVersion'] = data.encryptVersion;
    }

    const [userKeys, wasCreated] = await this.model.findOrCreate({
      where: { userId, ...optionalWhere },
      defaults: data,
    });

    return userKeys
      ? [this.toDomain(userKeys), wasCreated]
      : [null, wasCreated];
  }

  async findUserKeys(userId: UserAttributes['id']): Promise<KeyServer[]> {
    const userKeys = await this.model.findAll({
      where: { userId },
    });
    return userKeys ? userKeys.map(this.toDomain.bind(this)) : null;
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

  async deleteByUserId(userId: UserAttributes['id']): Promise<void> {
    await this.model.destroy({ where: { userId } });
  }

  async create(
    userId: UserAttributes['id'],
    data: Partial<KeyServerAttributes>,
  ) {
    const newUserKeys = await this.model.create({ userId, ...data });
    return newUserKeys ? this.toDomain(newUserKeys) : null;
  }

  toDomain(keyServer: KeyServerModel): KeyServer {
    return KeyServer.build(keyServer.toJSON());
  }
}
