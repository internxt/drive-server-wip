import {
  Table,
  Model,
  PrimaryKey,
  AutoIncrement,
  Column,
  DataType,
  AllowNull,
  Unique,
  ForeignKey,
  BelongsTo,
  HasMany,
  Default,
} from 'sequelize-typescript';
import { FolderModel } from '../folder/folder.model';
import { SendLinkModel } from '../send/send-link.model';
import { UserAttributes } from './user.domain';

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

  @HasMany(() => SendLinkModel)
  sendLinks: SendLinkModel[];

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
