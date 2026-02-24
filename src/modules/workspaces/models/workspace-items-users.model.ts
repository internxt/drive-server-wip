import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { WorkspaceModel } from './workspace.model';
import { UserModel } from '../../user/user.model';
import { type WorkspaceItemUserAttributes } from '../attributes/workspace-items-users.attributes';
import { FolderModel } from '../../folder/folder.model';
import { FileModel } from '../../file/file.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'workspace_items_users',
})
export class WorkspaceItemUserModel
  extends Model
  implements WorkspaceItemUserAttributes
{
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => WorkspaceModel)
  @Column({ type: DataType.UUID, allowNull: false })
  workspaceId: string;

  @BelongsTo(() => WorkspaceModel, {
    foreignKey: 'workspaceId',
    targetKey: 'id',
    as: 'workspace',
  })
  workspace: WorkspaceModel;

  @Column(DataType.UUID)
  itemId: string;

  @BelongsTo(() => FolderModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
  })
  folder: FolderModel;

  @BelongsTo(() => FileModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
  })
  file: FileModel;

  @Column(DataType.STRING)
  itemType: WorkspaceItemUserAttributes['itemType'];

  @Column(DataType.STRING)
  context: WorkspaceItemUserAttributes['context'];

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  createdBy: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'createdBy',
    targetKey: 'uuid',
    as: 'creator',
  })
  creator: UserModel;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
