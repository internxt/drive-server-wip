import {
  Column,
  Model,
  Table,
  PrimaryKey,
  ForeignKey,
  DataType,
  BelongsTo,
} from 'sequelize-typescript';

import { ThumbnailAttributes } from './thumbnail.attributes';
import { FileModel } from '../file/file.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'thumbnails',
})
export class ThumbnailModel extends Model implements ThumbnailAttributes {
  @PrimaryKey
  @Column
  id: number;

  @ForeignKey(() => FileModel)
  @Column(DataType.INTEGER)
  fileId: number;

  @BelongsTo(() => FileModel, 'id')
  file: FileModel;

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
