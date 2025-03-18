import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo,
  Index,
  HasMany,
} from 'sequelize-typescript';
import { UserModel } from '../../user/user.model';
import { BackupModel } from './backup.model';
import { DeviceAttributes } from './device.attributes';

@Table({
  timestamps: true,
  tableName: 'devices',
})
export class DeviceModel extends Model implements DeviceAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Index
  @Column(DataType.STRING)
  mac: string;

  @ForeignKey(() => UserModel)
  @Column
  userId: number;

  @AllowNull
  @Column(DataType.STRING)
  name: string;

  @AllowNull
  @Column(DataType.STRING(20))
  platform: string;

  @AllowNull
  @Column(DataType.DATE)
  createdAt: Date;

  @AllowNull
  @Column(DataType.DATE)
  updatedAt: Date;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @HasMany(() => BackupModel, {
    foreignKey: 'deviceId',
    as: 'backups',
  })
  backups: BackupModel[];
}
