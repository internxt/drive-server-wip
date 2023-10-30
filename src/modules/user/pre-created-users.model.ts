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

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'pre_created_users',
})
export class PreCreatedUserModel extends Model {
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
  encryptVersion: string;

  @Column
  password: string;

  @Column
  mnemonic: string;

  @Column
  expirationAt: Date;

  @Column
  hKey: Buffer;
}
