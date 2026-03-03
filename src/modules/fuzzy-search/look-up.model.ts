import {
  Column,
  PrimaryKey,
  Table,
  Model,
  Index,
  BelongsTo,
  ForeignKey,
  DataType,
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
  @Column(DataType.UUIDV4)
  declare id: string;

  @Column(DataType.UUIDV4)
  declare itemId: string;

  @Column(DataType.STRING)
  declare itemType: ItemType;

  @Index
  @ForeignKey(() => UserModel)
  @Column(DataType.UUIDV4)
  declare userId: string;

  @Column(DataType.STRING)
  declare name: string;

  @Column(DataType.STRING)
  declare tokenizedName: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'userId',
    targetKey: 'uuid',
  })
  declare user: UserModel;

  @BelongsTo(() => FileModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
    as: 'file',
  })
  declare file: FileModel;

  @BelongsTo(() => FolderModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
    as: 'folder',
  })
  declare folder: FolderModel;

  @BelongsTo(() => WorkspaceItemUserModel, {
    foreignKey: 'itemId',
    targetKey: 'itemId',
    as: 'workspaceItemUser',
  })
  declare workspaceItemUser: WorkspaceItemUserModel;
}
