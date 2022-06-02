import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './user.model';

export interface UserRepository {
  findByUsername(username: string): Promise<User | null>;
}

@Injectable()
export class SequelizeUserRepository implements UserRepository {
  constructor(
    @InjectModel(User)
    private modelUser: typeof User,
  ) {}

  async findByUsername(username: string): Promise<User> {
    return await this.modelUser.findOne({
      where: {
        username,
      },
    });
  }
}
