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
  Default,
} from 'sequelize-typescript';
import { UserModel } from '../../user/user.model';
import { BackupModel } from './backup.model';
import { type DeviceAttributes } from './device.attributes';
import { FolderModel } from '../../folder/folder.model';
import { DevicePlatform } from '../device.domain';

@Table({
  timestamps: true,
  tableName: 'devices',
})
export class DeviceModel extends Model implements DeviceAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull
  @Index
  @Column(DataType.STRING)
  mac: string;

  @ForeignKey(() => UserModel)
  @Column
  userId: number;

  @AllowNull(false)
  @ForeignKey(() => FolderModel)
  @Default('00000000-0000-0000-0000-000000000000')
  @Column({
    type: DataType.UUID,
    field: 'folder_uuid',
  })
  folderUuid: string;

  @AllowNull(false)
  @Default('UNKNOWN_KEY')
  @Column(DataType.STRING)
  key: string;

  @AllowNull(false)
  @Default('UNKNOWN_HOSTNAME')
  @Column(DataType.STRING)
  hostname: string;

  @AllowNull
  @Column(DataType.STRING)
  name: string;

  @AllowNull
  @Column(DataType.STRING(20))
  platform: DevicePlatform;

  @AllowNull
  @Column(DataType.DATE)
  createdAt: Date;

  @AllowNull
  @Column(DataType.DATE)
  updatedAt: Date;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @BelongsTo(() => FolderModel, {
    foreignKey: 'folderUuid',
    targetKey: 'uuid',
  })
  folder: FolderModel;

  @HasMany(() => BackupModel, {
    foreignKey: 'deviceId',
    as: 'backups',
  })
  backups: BackupModel[];
}
