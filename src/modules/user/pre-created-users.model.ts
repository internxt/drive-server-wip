import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  AutoIncrement,
  AllowNull,
  Unique,
} from 'sequelize-typescript';
import { type PreCreatedUserAttributes } from './pre-created-users.attributes';
import { type KeyServerAttributes } from '../keyserver/key-server.domain';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'pre_created_users',
})
export class PreCreatedUserModel
  extends Model
  implements PreCreatedUserAttributes
{
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column(DataType.UUIDV4)
  declare uuid: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare email: string;

  @Unique
  @Column(DataType.STRING)
  declare username: string;

  @Column(DataType.STRING(920))
  declare publicKey: string;

  @Column(DataType.STRING(1356))
  declare privateKey: string;

  @Column(DataType.STRING(476))
  declare revocationKey: string;

  @Column(DataType.STRING)
  declare encryptVersion: KeyServerAttributes['encryptVersion'];

  @AllowNull(true)
  @Column(DataType.STRING(4000))
  declare privateKyberKey?: string;

  @AllowNull(true)
  @Column(DataType.STRING(2000))
  declare publicKyberKey?: string;

  @Column(DataType.STRING)
  declare password: string;

  @Column(DataType.STRING)
  declare mnemonic: string;

  @Column(DataType.BLOB)
  declare hKey: Buffer;
}
