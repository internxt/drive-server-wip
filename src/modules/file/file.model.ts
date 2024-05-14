import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Index,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import { FolderModel } from '../folder/folder.model';
import { FileAttributes, FileStatus } from './file.domain';
import { ShareModel } from '../share/share.repository';
import { Share } from '../share/share.domain';
import { ThumbnailModel } from '../thumbnail/thumbnail.model';
import { UserModel } from '../user/user.model';
import { SharingModel } from '../sharing/models';
import { Sharing } from '../sharing/sharing.domain';

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

  @HasMany(() => ShareModel, 'fileId')
  shares: Share[];

  @HasMany(() => ThumbnailModel, 'fileId')
  thumbnails: ThumbnailModel[];

  @HasMany(() => SharingModel, { sourceKey: 'uuid', foreignKey: 'itemId' })
  sharings: Sharing[];
}
