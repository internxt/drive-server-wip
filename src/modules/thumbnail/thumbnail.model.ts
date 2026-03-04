import {
  Column,
  Model,
  Table,
  PrimaryKey,
  ForeignKey,
  DataType,
  BelongsTo,
  AutoIncrement,
} from 'sequelize-typescript';

import { type ThumbnailAttributes } from './thumbnail.attributes';
import { FileModel } from '../file/file.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'thumbnails',
})
export class ThumbnailModel extends Model implements ThumbnailAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => FileModel)
  @Column(DataType.INTEGER)
  fileId: number;

  @ForeignKey(() => FileModel)
  @Column(DataType.UUID)
  fileUuid: string;

  @BelongsTo(() => FileModel, { foreignKey: 'fileUuid', targetKey: 'uuid' })
  fileByUuid: FileModel;

  @Column
  type: string;

  @Column
  size: number;

  @Column
  bucketId: string;

  @Column
  bucketFile: string;

  @Column
  encryptVersion: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;

  @Column
  maxWidth: number;

  @Column
  maxHeight: number;
}
