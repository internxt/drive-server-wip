import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';

import { PreCreatedUserModel } from './pre-created-users.model';
import { PreCreatedUserAttributes } from './pre-created-users.attributes';
import { PreCreatedUser } from './pre-created-user.domain';

@Injectable()
export class SequelizePreCreatedUsersRepository {
  constructor(
    @InjectModel(PreCreatedUserModel)
    private modelUser: typeof PreCreatedUserModel,
  ) {}

  async findById(id: number): Promise<PreCreatedUser | null> {
    const user = await this.modelUser.findByPk(id);
    return user ? this.toDomain(user) : null;
  }

  async create(
    user: Omit<PreCreatedUserAttributes, 'id'>,
  ): Promise<PreCreatedUser> {
    const dbUser = await this.modelUser.create(user);

    return this.toDomain(dbUser);
  }

  async deleteByUuid(uuid: PreCreatedUserAttributes['uuid']): Promise<void> {
    await this.modelUser.destroy({
      where: { uuid },
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
