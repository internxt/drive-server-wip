import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  ForeignKey,
  Default,
  BelongsTo,
} from 'sequelize-typescript';
import { WorkspaceModel } from './workspace.model';
import { UserModel } from '../../user/user.model';
import { WorkspaceItemUserAttributes } from '../attributes/workspace-items-users.attributes';

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
  @Column(DataType.UUID)
  workspaceId: string;

  @BelongsTo(() => WorkspaceModel, {
    foreignKey: 'workspaceId',
    targetKey: 'id',
    as: 'workspace',
  })
  workspace: WorkspaceModel;

  @Column(DataType.UUID)
  itemId: string;

  @Column(DataType.STRING)
  itemType: string;

  @Column(DataType.STRING)
  context: string;

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
