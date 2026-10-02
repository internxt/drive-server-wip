import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';

import { PreCreatedUserModel } from './pre-created-users.model';
import { type PreCreatedUserAttributes } from './pre-created-users.attributes';
import { PreCreatedUser } from './pre-created-user.domain';
import { Op, type Transaction } from 'sequelize';

@Injectable()
export class SequelizePreCreatedUsersRepository {
  constructor(
    @InjectModel(PreCreatedUserModel)
    private readonly modelUser: typeof PreCreatedUserModel,
  ) {}

  async findById(id: number): Promise<PreCreatedUser | null> {
    const user = await this.modelUser.findByPk(id);
    return user ? this.toDomain(user) : null;
  }

  async findByUuids(
    uuids: PreCreatedUserAttributes['uuid'][],
  ): Promise<PreCreatedUser[]> {
    const preCreatedUsers = await this.modelUser.findAll({
      where: { uuid: { [Op.in]: uuids } },
    });

    return preCreatedUsers.map((user) => this.toDomain(user));
  }

  async findByUuid(
    uuid: PreCreatedUserAttributes['uuid'],
  ): Promise<PreCreatedUser | null> {
    const user = await this.modelUser.findOne({ where: { uuid } });
    return user ? this.toDomain(user) : null;
  }

  async updateByUuid(
    uuid: PreCreatedUserAttributes['uuid'],
    update: Partial<Omit<PreCreatedUserAttributes, 'id'>>,
  ): Promise<void> {
    await this.modelUser.update(update, { where: { uuid } });
  }

  async create(
    user: Omit<PreCreatedUserAttributes, 'id'>,
  ): Promise<PreCreatedUser> {
    const dbUser = await this.modelUser.create(user);

    return this.toDomain(dbUser);
  }

  async deleteByUuid(
    uuid: PreCreatedUserAttributes['uuid'],
    transaction?: Transaction,
  ): Promise<void> {
    await this.modelUser.destroy({
      where: { uuid },
      transaction,
    });
  }

  async findByUsername(
    username: PreCreatedUserAttributes['username'],
  ): Promise<PreCreatedUser | null> {
    const user = await this.modelUser.findOne({
      where: {
        username,
      },
    });
    return user ? this.toDomain(user) : null;
  }

  toDomain(model: PreCreatedUserModel): PreCreatedUser {
    return PreCreatedUser.build({
      ...model.toJSON(),
    });
  }
}
