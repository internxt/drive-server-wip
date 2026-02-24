import {
  AutoIncrement,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import {
  UserKeysEncryptVersions,
  type KeyServerAttributes,
} from './key-server.domain';
import { UserModel } from '../user/user.model';

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

  @Column(DataType.STRING(2000))
  publicKey: string;

  @Column(DataType.STRING(3200))
  privateKey: string;

  @Column(DataType.STRING(476))
  revocationKey: string;

  @Column(DataType.STRING)
  encryptVersion: UserKeysEncryptVersions;
}
