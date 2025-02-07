import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { UserModel } from '../../user/user.model';

@Table({
  timestamps: true,
  tableName: 'backups',
})
export class BackupModel extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => UserModel)
  @Column
  userId: number;

  @Column(DataType.STRING)
  planId: string;

  @Column(DataType.UUID)
  uuid: string;

  @AllowNull
  @Column(DataType.TEXT)
  path: string;

  @AllowNull
  @Column(DataType.STRING(24))
  fileId: string;

  @AllowNull
  @Column
  deviceId: number;

  @AllowNull
  @Column(DataType.STRING)
  hash: string;

  @AllowNull
  @Column
  interval: number;

  @AllowNull
  @Column(DataType.BIGINT.UNSIGNED)
  size: number;

  @AllowNull
  @Column(DataType.STRING(24))
  bucket: string;

  @AllowNull
  @Column(DataType.DATE)
  lastBackupAt: Date;

  @Default(true)
  @Column
  enabled: boolean;

  @AllowNull
  @Column(DataType.STRING)
  encryptVersion: string;

  @AllowNull
  @Column(DataType.DATE)
  createdAt: Date;

  @AllowNull
  @Column(DataType.DATE)
  updatedAt: Date;

  @BelongsTo(() => UserModel)
  user: UserModel;
}
