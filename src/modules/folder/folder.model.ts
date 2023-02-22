import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { UserModel } from '../user/user.model';
import { FolderAttributes } from './folder.attributes';

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

  @Index
  @Column
  uuid: string;

  @ForeignKey(() => FolderModel)
  @Column
  parentId: number;

  @BelongsTo(() => FolderModel)
  parent: FolderModel;

  @ForeignKey(() => FolderModel)
  @Column(DataType.UUIDV4)
  parentUuid: FolderAttributes['uuid'];

  @Index
  @Column
  name: string;

  @Index
  @Column
  plainName: string;

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
