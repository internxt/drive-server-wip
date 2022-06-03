import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './user.model';

export interface UserRepository {
  findAllBy(where: any): Promise<Array<User> | []>;
  findByUsername(username: string): Promise<User | null>;
}

@Injectable()
export class SequelizeUserRepository implements UserRepository {
  constructor(
    @InjectModel(User)
    private modelUser: typeof User,
  ) {}

  async findAllBy(where: any): Promise<Array<User> | []> {
    return await this.modelUser.findAll({ where });
  }
  async findByUsername(username: string): Promise<User> {
    return await this.modelUser.findOne({
      where: {
        username,
      },
    });
  }
}
