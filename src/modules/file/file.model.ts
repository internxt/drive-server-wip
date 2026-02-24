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
  @Column
  id: number;

  @Unique
  @Column(DataType.UUIDV4)
  uuid: string;

  @AllowNull
  @Column(DataType.STRING(24))
  fileId: string;

  @Index
  @Column
  name: string;

  @Index
  @Column
  plainName: string;

  @Column
  type: string;

  @Column(DataType.BIGINT.UNSIGNED)
  size: bigint;

  @Column(DataType.STRING(24))
  bucket: string;

  @ForeignKey(() => FolderModel)
  @Column(DataType.INTEGER)
  folderId: number;

  @BelongsTo(() => FolderModel)
  folder: FolderModel;

  @ForeignKey(() => FolderModel)
  @Column(DataType.UUIDV4)
  folderUuid: string;

  @Column
  encryptVersion: string;

  @ForeignKey(() => UserModel)
  @Column
  userId: number;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @Default(Sequelize.fn('NOW'))
  @Column
  creationTime: Date;

  @Default(Sequelize.fn('NOW'))
  @Column
  modificationTime: Date;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;

  @Default(false)
  @Column
  removed: boolean;

  @AllowNull
  @Column
  removedAt: Date;

  @Default(false)
  @Column
  deleted: boolean;

  @AllowNull
  @Column
  deletedAt: Date;

  @Column({
    type: DataType.ENUM,
    values: Object.values(FileStatus),
    defaultValue: FileStatus.EXISTS,
    allowNull: false,
  })
  status: FileStatus;

  @HasOne(() => WorkspaceItemUserModel, {
    foreignKey: 'itemId',
    sourceKey: 'uuid',
  })
  workspaceUser: WorkspaceItemUserModel;

  @HasMany(() => ThumbnailModel, {
    foreignKey: 'fileUuid',
    sourceKey: 'uuid',
  })
  thumbnails: ThumbnailModel[];

  @HasMany(() => SharingModel, { sourceKey: 'uuid', foreignKey: 'itemId' })
  sharings: Sharing[];
}
