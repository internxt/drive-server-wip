import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User as UserModel } from './user.model';
import { User, UserAttributes } from './user.domain';
import { Folder } from '../folder/folder.domain';
export interface UserRepository {
  findAllBy(where: any): Promise<Array<User> | []>;
  findByUsername(username: string): Promise<User | null>;
  _toDomain(model: UserModel): User;
  _toModel(domain: User): Partial<UserAttributes>;
}

@Injectable()
export class SequelizeUserRepository implements UserRepository {
  constructor(
    @InjectModel(UserModel)
    private modelUser: typeof UserModel,
  ) {}

  async findAllBy(where: any): Promise<Array<User> | []> {
    const users = await this.modelUser.findAll({ where });
    return users.map((user) => this._toDomain(user));
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await this.modelUser.findOne({
      where: {
        username,
      },
    });
    return user ? this._toDomain(user) : null;
  }

  _toDomain(model: UserModel): User {
    return User.build({
      ...model.toJSON(),
      rootFolder: model.rootFolder ? Folder.build(model.rootFolder) : null,
    });
  }

  _toModel(domain: User): Partial<UserAttributes> {
    return domain.toJSON();
  }
}
