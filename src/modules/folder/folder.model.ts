import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  HasOne,
  Index,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { UserModel } from '../user/user.model';
import { type FolderAttributes } from './folder.attributes';
import { SharingModel } from '../sharing/models';
import { type Sharing } from '../sharing/sharing.domain';
import { WorkspaceItemUserModel } from '../workspaces/models/workspace-items-users.model';
import { Sequelize } from 'sequelize';
import { DeviceModel } from '../backups/models/device.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'folders',
})
export class FolderModel extends Model implements FolderAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Index
  @Column
  uuid: string;

  @ForeignKey(() => FolderModel)
  @Column
  parentId: number;

  @BelongsTo(() => FolderModel)
  parent: FolderModel;

  @ForeignKey(() => FolderModel)
  @Column(DataType.UUIDV4)
  parentUuid: FolderAttributes['uuid'];

  @Index
  @Column
  name: string;

  @Column(DataType.STRING(24))
  bucket: string;

  @ForeignKey(() => UserModel)
  @Column
  userId: number;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @HasOne(() => DeviceModel)
  device: DeviceModel;

  @Column
  encryptVersion: '03-aes';

  @Index
  @Column
  plainName: string;

  @Default(false)
  @Column
  deleted: boolean;

  @Default(false)
  @Column
  removed: boolean;

  @Default(Sequelize.fn('NOW'))
  @Column
  creationTime: Date;

  @Default(Sequelize.fn('NOW'))
  @Column
  modificationTime: Date;

  @AllowNull
  @Column
  deletedAt: Date;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;

  @Column
  removedAt: Date;

  @HasMany(() => SharingModel, { sourceKey: 'uuid', foreignKey: 'itemId' })
  sharings: Sharing[];

  @HasOne(() => WorkspaceItemUserModel, {
    foreignKey: 'itemId',
    sourceKey: 'uuid',
  })
  workspaceUser: WorkspaceItemUserModel;
}
