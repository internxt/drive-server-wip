import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  Index,
} from 'sequelize-typescript';

@Table({
  underscored: true,
  timestamps: true,
})
export class File extends Model {
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
}