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
  @Column(DataType.INTEGER)
  declare id: number;

  @Index
  @Column(DataType.UUIDV4)
  declare uuid: string;

  @ForeignKey(() => FolderModel)
  @Column(DataType.INTEGER)
  declare parentId: number;

  @BelongsTo(() => FolderModel)
  declare parent: FolderModel;

  @ForeignKey(() => FolderModel)
  @Column(DataType.UUIDV4)
  declare parentUuid: FolderAttributes['uuid'];

  @Index
  @Column(DataType.STRING)
  declare name: string;

  @Column(DataType.STRING(24))
  declare bucket: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.INTEGER)
  declare userId: number;

  @BelongsTo(() => UserModel)
  declare user: UserModel;

  @HasOne(() => DeviceModel)
  declare device: DeviceModel;

  @Column(DataType.STRING)
  declare encryptVersion: '03-aes';

  @Index
  @Column(DataType.STRING)
  declare plainName: string;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare deleted: boolean;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare removed: boolean;

  @Default(Sequelize.fn('NOW'))
  @Column(DataType.DATE)
  declare creationTime: Date;

  @Default(Sequelize.fn('NOW'))
  @Column(DataType.DATE)
  declare modificationTime: Date;

  @AllowNull
  @Column(DataType.DATE)
  declare deletedAt: Date;

  @Column(DataType.DATE)
  declare createdAt: Date;

  @Column(DataType.DATE)
  declare updatedAt: Date;

  @Column(DataType.DATE)
  declare removedAt: Date;

  @HasMany(() => SharingModel, { sourceKey: 'uuid', foreignKey: 'itemId' })
  declare sharings: Sharing[];

  @HasOne(() => WorkspaceItemUserModel, {
    foreignKey: 'itemId',
    sourceKey: 'uuid',
  })
  declare workspaceUser: WorkspaceItemUserModel;
}
