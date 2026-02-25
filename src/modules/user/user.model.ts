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

  @AllowNull
  @Column
  avatar: string;

  @AllowNull
  @Column
  lastPasswordChangedAt: Date;

  @AllowNull
  @Column
  updatedAt: Date;

  @AllowNull
  @Column
  createdAt: Date;

  @AllowNull
  @Column
  tierId: string;

  @Default(false)
  @AllowNull(false)
  @Column
  emailVerified: boolean;

  @HasMany(() => UserNotificationTokensModel)
  notificationTokens: UserNotificationTokensModel[];
}
