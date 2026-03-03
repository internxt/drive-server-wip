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
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => FileModel)
  @Column(DataType.INTEGER)
  declare fileId: number;

  @ForeignKey(() => FileModel)
  @Column(DataType.UUID)
  declare fileUuid: string;

  @BelongsTo(() => FileModel, { foreignKey: 'fileUuid', targetKey: 'uuid' })
  declare fileByUuid: FileModel;

  @Column(DataType.STRING)
  declare type: string;

  @Column(DataType.INTEGER)
  declare size: number;

  @Column(DataType.STRING)
  declare bucketId: string;

  @Column(DataType.STRING)
  declare bucketFile: string;

  @Column(DataType.STRING)
  declare encryptVersion: string;

  @Column(DataType.DATE)
  declare createdAt: Date;

  @Column(DataType.DATE)
  declare updatedAt: Date;

  @Column(DataType.INTEGER)
  declare maxWidth: number;

  @Column(DataType.INTEGER)
  declare maxHeight: number;
}
