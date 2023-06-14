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

  @BelongsTo(() => FileModel, 'fileId')
  file: FileModel;

  @Column
  type: string;

  @Column
  size: number;

  @Column
  bucket_id: string;

  @Column
  bucket_file: string;

  @Column
  encrypt_version: string;

  @Column
  created_at: Date;

  @Column
  updated_at: Date;

  @Column
  max_width: number;

  @Column
  max_height: number;
}
