import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  Default,
  AutoIncrement,
  AllowNull,
  BelongsTo,
  ForeignKey,
  Index,
} from 'sequelize-typescript';
import { FolderAttributes } from './folder.domain';

@Table({
  underscored: true,
  timestamps: true,
})
export class Folder extends Model implements FolderAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Folder)
  @Column
  parentId: number;

  @BelongsTo(() => Folder)
  parent: Folder;

  @Index
  @Column
  name: string;

  @Column(DataType.STRING(24))
  bucket: string;

  // TODO: References user
  @Column
  userId: number;

  @Column
  encryptVersion: string;

  @Default(false)
  @Column
  deleted: boolean;

  @AllowNull
  @Column
  deletedAt: Date;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
