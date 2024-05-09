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
import { WorkspaceItemUserAttributes } from '../attributes/workspace-items-users.attributes';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'workspace_items_users',
})
export class WorkspaceItemsUser
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

  @Column({ type: DataType.STRING, allowNull: false })
  context: string;

  @Column({ type: DataType.STRING, allowNull: false })
  itemType: string;

  @Column({ type: DataType.STRING, allowNull: false })
  itemId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  createdBy: string;

  @Column({ allowNull: false, defaultValue: DataType.NOW })
  createdAt: Date;

  @Column({ allowNull: false, defaultValue: DataType.NOW })
  updatedAt: Date;
}
