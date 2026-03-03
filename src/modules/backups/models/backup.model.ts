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
import { DeviceModel } from './device.model';
import { type BackupAttributes } from './backup.attributes';

@Table({
  timestamps: true,
  tableName: 'backups',
})
export class BackupModel extends Model implements BackupAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => UserModel)
  @Column
  userId: number;
  @AllowNull
  @Column(DataType.TEXT)
  path: string;

  @AllowNull
  @Column(DataType.STRING(24))
  fileId: string;

  @ForeignKey(() => DeviceModel)
  @Column(DataType.INTEGER)
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
  encrypt_version: string;

  @AllowNull
  @Column(DataType.DATE)
  createdAt: Date;

  @AllowNull
  @Column(DataType.DATE)
  updatedAt: Date;

  @BelongsTo(() => UserModel)
  user: UserModel;
}
