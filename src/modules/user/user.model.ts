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
  HasMany,
} from 'sequelize-typescript';

import { FolderModel } from '../folder/folder.model';
import { type UserAttributes } from './user.attributes';
import { UserNotificationTokensModel } from './user-notification-tokens.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'users',
})
export class UserModel extends Model implements UserAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column(DataType.STRING(60))
  declare userId: string;

  @Column(DataType.STRING)
  declare name: string;

  @Column(DataType.STRING)
  declare lastname: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare email: string;

  @Unique
  @Column(DataType.STRING)
  declare username: string;

  @Column(DataType.STRING)
  declare bridgeUser: string;

  @Column(DataType.STRING)
  declare password: string;

  @Column(DataType.STRING)
  declare mnemonic: string;

  @ForeignKey(() => FolderModel)
  @Column(DataType.INTEGER)
  declare rootFolderId: number;

  @BelongsTo(() => FolderModel)
  declare rootFolder: FolderModel;

  @Column(DataType.BLOB)
  declare hKey: Buffer;

  @Column(DataType.STRING)
  declare secret_2FA: string;

  @Column(DataType.INTEGER)
  declare errorLoginCount: number;

  @Default(false)
  @AllowNull
  @Column(DataType.INTEGER)
  declare isEmailActivitySended: number;

  @AllowNull
  @Column(DataType.STRING)
  declare referralCode: string;

  @AllowNull
  @Column(DataType.STRING)
  declare referrer: string;

  @AllowNull
  @Column(DataType.DATE)
  declare syncDate: Date;

  @Unique
  @Column(DataType.UUIDV4)
  declare uuid: string;

  @AllowNull
  @Column(DataType.DATE)
  declare lastResend: Date;

  @Default(0)
  @Column(DataType.INTEGER)
  declare credit: number;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare welcomePack: boolean;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare registerCompleted: boolean;

  @AllowNull
  @Column(DataType.STRING)
  declare backupsBucket: string;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare sharedWorkspace: boolean;

  @AllowNull
  @Column(DataType.STRING)
  declare avatar: string;

  @AllowNull
  @Column(DataType.DATE)
  declare lastPasswordChangedAt: Date;

  @AllowNull
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @AllowNull
  @Column(DataType.DATE)
  declare createdAt: Date;

  @AllowNull
  @Column(DataType.STRING)
  declare tierId: string;

  @Default(false)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare emailVerified: boolean;

  @HasMany(() => UserNotificationTokensModel)
  declare notificationTokens: UserNotificationTokensModel[];
}
