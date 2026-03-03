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
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => UserModel)
  @Column(DataType.INTEGER)
  declare userId: number;

  @Column(DataType.STRING(2000))
  declare publicKey: string;

  @Column(DataType.STRING(3200))
  declare privateKey: string;

  @Column(DataType.STRING(476))
  declare revocationKey: string;

  @Column(DataType.STRING)
  declare encryptVersion: UserKeysEncryptVersions;
}
