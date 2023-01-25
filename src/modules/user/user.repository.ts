import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User, UserAttributes } from './user.domain';
import { Folder } from '../folder/folder.domain';
import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  Default,
  AutoIncrement,
  AllowNull,
  BelongsTo,
  ForeignKey,
  Unique,
} from 'sequelize-typescript';

import { FolderModel } from '../folder/folder.repository';
import { FindOrCreateOptions, Transaction } from 'sequelize/types';
@Table({
  underscored: true,
  timestamps: true,
  tableName: 'users',
})
export class UserModel extends Model implements UserAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.STRING(60))
  userId: string;

  @Column
  name: string;

  @Column
  lastname: string;

  @AllowNull(false)
  @Column
  email: string;

  @Unique
  @Column
  username: string;

  @Column
  bridgeUser: string;

  @Column
  password: string;

  @Column
  mnemonic: string;

  @ForeignKey(() => FolderModel)
  @Column
  rootFolderId: number;

  @BelongsTo(() => FolderModel)
  rootFolder: FolderModel;

  @Column
  hKey: Buffer;

  @Column
  secret_2FA: string;

  @Column
  errorLoginCount: number;

  @Default(false)
  @AllowNull
  @Column
  isEmailActivitySended: number;

  @AllowNull
  @Column
  referralCode: string;

  @AllowNull
  @Column
  referrer: string;

  @AllowNull
  @Column
  syncDate: Date;

  @Unique
  @Column
  uuid: string;

  @AllowNull
  @Column
  lastResend: Date;

  @Default(0)
  @Column
  credit: number;

  @Default(false)
  @Column
  welcomePack: boolean;

  @Default(true)
  @Column
  registerCompleted: boolean;

  @AllowNull
  @Column
  backupsBucket: string;

  @Default(false)
  @Column
  sharedWorkspace: boolean;

  @Column
  tempKey: string;

  @AllowNull
  @Column
  avatar: string;
}

export interface UserRepository {
  findById(id: number): Promise<User | null>;
  findByUuid(uuid: User['uuid']): Promise<User | null>;
  findAllBy(where: any): Promise<Array<User> | []>;
  findByBridgeUser(bridgeUser: User['bridgeUser']): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  toDomain(model: UserModel): User;
  toModel(domain: User): Partial<UserAttributes>;
}

@Injectable()
export class SequelizeUserRepository implements UserRepository {
  constructor(
    @InjectModel(UserModel)
    private modelUser: typeof UserModel,
  ) {}
  async findById(id: number): Promise<User | null> {
    const user = await this.modelUser.findByPk(id);
    return user ? this.toDomain(user) : null;
  }

  async findByUuid(uuid: User['uuid']): Promise<User | null> {
    const user = await this.modelUser.findOne({ where: { uuid } });
    return user ? this.toDomain(user) : null;
  }

  createTransaction(): Promise<Transaction> {
    return this.modelUser.sequelize.transaction();
  }

  async findByBridgeUser(bridgeUser: string): Promise<User | null> {
    const user = await this.modelUser.findOne({ where: { bridgeUser } });

    return user ? this.toDomain(user) : null;
  }

  findOrCreate(opts: FindOrCreateOptions): Promise<[User | null, boolean]> {
    return this.modelUser.findOrCreate(opts) as any;
  }

  async findByReferralCode(
    referralCode: UserAttributes['referralCode'],
  ): Promise<User | null> {
    const user = await this.modelUser.findOne({ where: { referralCode } });

    return user ? this.toDomain(user) : null;
  }

  async findAllBy(where: any): Promise<Array<User> | []> {
    const users = await this.modelUser.findAll({ where });
    return users.map((user) => this.toDomain(user));
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await this.modelUser.findOne({
      where: {
        username,
      },
    });
    return user ? this.toDomain(user) : null;
  }

  async updateById(
    id: UserAttributes['id'],
    update: Partial<UserAttributes>,
    transaction?: Transaction,
  ): Promise<void> {
    await this.modelUser.update(update, { where: { id }, transaction });
  }

  toDomain(model: UserModel): User {
    return User.build({
      ...model.toJSON(),
      rootFolder: model.rootFolder ? Folder.build(model.rootFolder) : null,
    });
  }

  toModel(domain: User): Partial<UserAttributes> {
    return domain.toJSON();
  }
}
