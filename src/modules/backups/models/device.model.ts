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
import { FolderModel } from '../../folder/folder.model';

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

  @AllowNull
  @ForeignKey(() => FolderModel)
  @Column({
    type: DataType.UUID,
    field: 'folder_uuid',
  })
  folderUuid: string;

  @AllowNull
  @Index
  @Column(DataType.STRING)
  key: string;

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
