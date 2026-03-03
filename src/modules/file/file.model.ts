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
  Unique,
} from 'sequelize-typescript';
import { FolderModel } from '../folder/folder.model';
import { type FileAttributes, FileStatus } from './file.domain';
import { ThumbnailModel } from '../thumbnail/thumbnail.model';
import { UserModel } from '../user/user.model';
import { SharingModel } from '../sharing/models';
import { type Sharing } from '../sharing/sharing.domain';
import { WorkspaceItemUserModel } from '../workspaces/models/workspace-items-users.model';
import { Sequelize } from 'sequelize';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'files',
})
export class FileModel extends Model implements FileAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Unique
  @Column(DataType.UUIDV4)
  declare uuid: string;

  @AllowNull
  @Column(DataType.STRING(24))
  declare fileId: string;

  @Index
  @Column(DataType.STRING)
  declare name: string;

  @Index
  @Column(DataType.STRING)
  declare plainName: string;

  @Column(DataType.STRING)
  declare type: string;

  @Column(DataType.BIGINT.UNSIGNED)
  declare size: bigint;

  @Column(DataType.STRING(24))
  declare bucket: string;

  @ForeignKey(() => FolderModel)
  @Column(DataType.INTEGER)
  declare folderId: number;

  @BelongsTo(() => FolderModel)
  declare folder: FolderModel;

  @ForeignKey(() => FolderModel)
  @Column(DataType.UUIDV4)
  declare folderUuid: string;

  @Column(DataType.STRING)
  declare encryptVersion: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.INTEGER)
  declare userId: number;

  @BelongsTo(() => UserModel)
  declare user: UserModel;

  @Default(Sequelize.fn('NOW'))
  @Column(DataType.DATE)
  declare creationTime: Date;

  @Default(Sequelize.fn('NOW'))
  @Column(DataType.DATE)
  declare modificationTime: Date;

  @Column(DataType.DATE)
  declare createdAt: Date;

  @Column(DataType.DATE)
  declare updatedAt: Date;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare removed: boolean;

  @AllowNull
  @Column(DataType.DATE)
  declare removedAt: Date;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare deleted: boolean;

  @AllowNull
  @Column(DataType.DATE)
  declare deletedAt: Date;

  @Column({
    type: DataType.ENUM,
    values: Object.values(FileStatus),
    defaultValue: FileStatus.EXISTS,
    allowNull: false,
  })
  declare status: FileStatus;

  @HasOne(() => WorkspaceItemUserModel, {
    foreignKey: 'itemId',
    sourceKey: 'uuid',
  })
  declare workspaceUser: WorkspaceItemUserModel;

  @HasMany(() => ThumbnailModel, {
    foreignKey: 'fileUuid',
    sourceKey: 'uuid',
  })
  declare thumbnails: ThumbnailModel[];

  @HasMany(() => SharingModel, { sourceKey: 'uuid', foreignKey: 'itemId' })
  declare sharings: Sharing[];
}
