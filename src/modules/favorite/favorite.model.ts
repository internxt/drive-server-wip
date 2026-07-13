import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { UserModel } from '../user/user.model';
import { FileModel } from '../file/file.model';
import { FolderModel } from '../folder/folder.model';
import { type FavoriteAttributes } from './favorite.domain';

@Table({
  underscored: true,
  timestamps: true,
  updatedAt: false,
  tableName: 'favorites',
})
export class FavoriteModel extends Model implements FavoriteAttributes {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.STRING(36))
  userId: FavoriteAttributes['userId'];

  @BelongsTo(() => UserModel, {
    foreignKey: 'userId',
    targetKey: 'uuid',
  })
  user: UserModel;

  @Column(DataType.UUID)
  itemId: FavoriteAttributes['itemId'];

  @BelongsTo(() => FileModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
  })
  file: FileModel;

  @BelongsTo(() => FolderModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
  })
  folder: FolderModel;

  @Column(DataType.STRING)
  itemType: FavoriteAttributes['itemType'];

  @Column
  createdAt: Date;
}
