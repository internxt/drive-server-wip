import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';

import { User } from './user.domain';
import { PreCreatedUserModel } from './pre-created-users.model';
import { PreCreatedUserAttributes } from './pre-created-users.attributes';

@Injectable()
export class SequelizePreCreatedUsersRepository {
  constructor(
    @InjectModel(PreCreatedUserModel)
    private modelUser: typeof PreCreatedUserModel,
  ) {}

  async findById(id: number): Promise<any | null> {
    const user = await this.modelUser.findByPk(id);
    return user;
  }

  async create(
    user: Omit<PreCreatedUserAttributes, 'id'>,
  ): Promise<PreCreatedUserModel> {
    const dbUser = await this.modelUser.create(user);

    return dbUser;
  }

  async findByUsername(
    username: PreCreatedUserAttributes['username'],
  ): Promise<PreCreatedUserModel | null> {
    const user = await this.modelUser.findOne({
      where: {
        username,
      },
    });
    return user;
  }

  toDomain(model: PreCreatedUserModel): User {
    return User.build({
      ...model.toJSON(),
    });
  }
}
