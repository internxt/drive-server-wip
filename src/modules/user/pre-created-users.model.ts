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
  @Column
  id: number;

  @Column(DataType.UUIDV4)
  uuid: string;

  @AllowNull(false)
  @Column
  email: string;

  @Unique
  @Column
  username: string;

  @Column(DataType.STRING(920))
  publicKey: string;

  @Column(DataType.STRING(1356))
  privateKey: string;

  @Column(DataType.STRING(476))
  revocationKey: string;

  @Column(DataType.STRING)
  encryptVersion: KeyServerAttributes['encryptVersion'];

  @AllowNull(true)
  @Column(DataType.STRING(4000))
  privateKyberKey?: string;

  @AllowNull(true)
  @Column(DataType.STRING(2000))
  publicKyberKey?: string;

  @Column
  password: string;

  @Column
  mnemonic: string;

  @Column
  hKey: Buffer;
}
