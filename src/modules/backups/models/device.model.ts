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
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull
  @Index
  @Column(DataType.STRING)
  declare mac: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.INTEGER)
  declare userId: number;

  @AllowNull(false)
  @ForeignKey(() => FolderModel)
  @Default('00000000-0000-0000-0000-000000000000')
  @Column({
    type: DataType.UUID,
    field: 'folder_uuid',
  })
  declare folderUuid: string;

  @AllowNull(false)
  @Default('UNKNOWN_KEY')
  @Column(DataType.STRING)
  declare key: string;

  @AllowNull(false)
  @Default('UNKNOWN_HOSTNAME')
  @Column(DataType.STRING)
  declare hostname: string;

  @AllowNull
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull
  @Column(DataType.STRING(20))
  declare platform: DevicePlatform;

  @AllowNull
  @Column(DataType.DATE)
  declare createdAt: Date;

  @AllowNull
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => UserModel)
  declare user: UserModel;

  @BelongsTo(() => FolderModel, {
    foreignKey: 'folderUuid',
    targetKey: 'uuid',
  })
  declare folder: FolderModel;

  @HasMany(() => BackupModel, {
    foreignKey: 'deviceId',
    as: 'backups',
  })
  declare backups: BackupModel[];
}
