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
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => UserModel)
  @Column(DataType.INTEGER)
  declare userId: number;

  @AllowNull
  @Column(DataType.TEXT)
  declare path: string;

  @AllowNull
  @Column(DataType.STRING(24))
  declare fileId: string;

  @ForeignKey(() => DeviceModel)
  @Column(DataType.INTEGER)
  declare deviceId: number;

  @AllowNull
  @Column(DataType.STRING)
  declare hash: string;

  @AllowNull
  @Column(DataType.INTEGER)
  declare interval: number;

  @AllowNull
  @Column(DataType.BIGINT.UNSIGNED)
  declare size: number;

  @AllowNull
  @Column(DataType.STRING(24))
  declare bucket: string;

  @AllowNull
  @Column(DataType.DATE)
  declare lastBackupAt: Date;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare enabled: boolean;

  @AllowNull
  @Column(DataType.STRING)
  declare encrypt_version: string;

  @AllowNull
  @Column(DataType.DATE)
  declare createdAt: Date;

  @AllowNull
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => UserModel)
  user: UserModel;
}
