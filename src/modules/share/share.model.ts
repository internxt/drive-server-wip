import {
  Column,
  Model,
  Table,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  DataType,
  Default,
  Unique,
} from 'sequelize-typescript';
import { File } from '../file/file.model';
import { Folder } from '../folder/folder.model';

@Table({
  underscored: true,
  timestamps: false,
})
export class Share extends Model {
  @PrimaryKey
  @Column
  id: number;

  @Unique
  @Column
  token: string;

  @Column(DataType.BLOB)
  mnemonic: string;

  // relation??
  @Column
  user: number;

  @ForeignKey(() => File)
  @Column(DataType.STRING(24))
  file: string;

  @BelongsTo(() => File, 'file')
  fileInfo: File;

  @Column(DataType.STRING(64))
  encryptionKey: string;

  @Column(DataType.STRING(24))
  bucket: string;

  @Column(DataType.STRING(64))
  fileToken: string;

  @Default(false)
  @Column
  isFolder: boolean;

  @Default(1)
  @Column
  views: number;
}
