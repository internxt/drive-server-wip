import {
  Column,
  PrimaryKey,
  Table,
  Model,
  Index,
  BelongsTo,
  ForeignKey,
} from 'sequelize-typescript';
import { ItemType, type LookUpAttributes } from './look-up.domain';
import { FileModel } from '../file/file.model';
import { FolderModel } from '../folder/folder.model';
import { UserModel } from '../user/user.model';
import { WorkspaceItemUserModel } from '../workspaces/models/workspace-items-users.model';

@Table({
  underscored: true,
  tableName: 'look_up',
  timestamps: false,
})
export class LookUpModel extends Model implements LookUpAttributes {
  @PrimaryKey
  @Column
  id: string;

  @Column
  itemId: string;

  @Column
  itemType: ItemType;

  @Index
  @ForeignKey(() => UserModel)
  @Column
  userId: string;

  @Column
  name: string;

  @Column
  tokenizedName: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'userId',
    targetKey: 'uuid',
  })
  user: UserModel;

  @BelongsTo(() => FileModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
    as: 'file',
  })
  file: FileModel;

  @BelongsTo(() => FolderModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
    as: 'folder',
  })
  folder: FolderModel;

  @BelongsTo(() => WorkspaceItemUserModel, {
    foreignKey: 'itemId',
    targetKey: 'itemId',
    as: 'workspaceItemUser',
  })
  workspaceItemUser: WorkspaceItemUserModel;
}
