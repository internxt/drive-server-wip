import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  Index,
  HasOne,
  HasMany,
} from 'sequelize-typescript';
import { FileAttributes } from './file.domain';
import { Share } from '../share/share.model';

@Table({
  underscored: true,
  timestamps: true,
})
export class File extends Model implements FileAttributes {
  @PrimaryKey
  @Column
  id: number;

  @Column(DataType.STRING(24))
  fileId: string;

  @Index
  @Column
  name: string;

  @Column
  type: string;

  @Column(DataType.BIGINT.UNSIGNED)
  size: bigint;

  @Column(DataType.STRING(24))
  bucket: string;

  @Column(DataType.INTEGER)
  folderId: number;

  @Column
  encryptVersion: string;

  @Column
  deleted: boolean;

  @Column
  deletedAt: Date;

  @Column
  userId: number;

  @Column
  modificationTime: Date;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;

  @HasMany(() => Share, 'fileId')
  share: Share;
}
