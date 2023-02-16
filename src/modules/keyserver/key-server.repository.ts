import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  AutoIncrement,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { UserAttributes } from '../user/user.attributes';
import { UserModel } from '../user/user.repository';
import { KeyServer, KeyServerAttributes } from './key-server.domain';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'keyserver',
})
export class KeyServerModel extends Model implements KeyServerAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => UserModel)
  @Column(DataType.INTEGER)
  userId: number;

  @Column(DataType.STRING(920))
  publicKey: string;

  @Column(DataType.STRING(1356))
  privateKey: string;

  @Column(DataType.STRING(476))
  revocationKey: string;

  @Column(DataType.STRING)
  encryptVersion: string;
}

export interface KeyServerRepository {
  findUserKeysOrCreate(
    userId: UserAttributes['id'],
    data: Partial<KeyServerAttributes>,
  ): Promise<[KeyServer | null, boolean]>;
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
}
