import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  ForeignKey,
  Default,
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
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => WorkspaceModel)
  @Column(DataType.UUID)
  workspaceId: string;

  @Column(DataType.UUID)
  itemId: string;

  @Column(DataType.STRING)
  itemType: string;

  @Column(DataType.STRING)
  context: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  createdBy: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
