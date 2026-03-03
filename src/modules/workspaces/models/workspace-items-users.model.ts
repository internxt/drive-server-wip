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
  declare id: string;

  @ForeignKey(() => WorkspaceModel)
  @Column({ type: DataType.UUID, allowNull: false })
  declare workspaceId: string;

  @BelongsTo(() => WorkspaceModel, {
    foreignKey: 'workspaceId',
    targetKey: 'id',
    as: 'workspace',
  })
  declare workspace: WorkspaceModel;

  @Column(DataType.UUID)
  declare itemId: string;

  @BelongsTo(() => FolderModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
  })
  declare folder: FolderModel;

  @BelongsTo(() => FileModel, {
    foreignKey: 'itemId',
    targetKey: 'uuid',
  })
  declare file: FileModel;

  @Column(DataType.STRING)
  declare itemType: WorkspaceItemUserAttributes['itemType'];

  @Column(DataType.STRING)
  declare context: WorkspaceItemUserAttributes['context'];

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  declare createdBy: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'createdBy',
    targetKey: 'uuid',
    as: 'creator',
  })
  declare creator: UserModel;

  @Column(DataType.DATE)
  declare createdAt: Date;

  @Column(DataType.DATE)
  declare updatedAt: Date;
}
