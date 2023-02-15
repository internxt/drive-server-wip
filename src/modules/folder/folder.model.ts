import {
  Table,
  Model,
  PrimaryKey,
  AutoIncrement,
  Column,
  ForeignKey,
  BelongsTo,
  Index,
  DataType,
  Default,
  AllowNull,
} from 'sequelize-typescript';
import { UserModel } from '../user/user.model';
import { FolderAttributes } from './folder.domain';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'folders',
})
export class FolderModel extends Model implements FolderAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => FolderModel)
  @Column
  parentId: number;

  @BelongsTo(() => FolderModel)
  parent: FolderModel;

  @Index
  @Column
  name: string;

  @Column(DataType.STRING(24))
  bucket: string;

  @ForeignKey(() => UserModel)
  @Column
  userId: number;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @Column
  encryptVersion: '03-aes';

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
