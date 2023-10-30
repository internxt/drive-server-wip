import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';

import { User } from './user.domain';
import { UserModel } from './user.model';
import { PreCreatedUserModel } from './pre-created-users.model';

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

  async create(user: any): Promise<any> {
    const dbUser = await this.modelUser.create(user);

    return dbUser;
  }

  async findByUsername(username: string): Promise<any | null> {
    const user = await this.modelUser.findOne({
      where: {
        username,
      },
    });
    return user;
  }

  toDomain(model: UserModel): User {
    return User.build({
      ...model.toJSON(),
    });
  }
}
export { UserModel };
