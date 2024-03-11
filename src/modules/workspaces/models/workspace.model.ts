import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  ForeignKey,
  Default,
} from 'sequelize-typescript';
import { UserModel } from '../../user/user.model';
import { TeamModel } from './team.model';
import { WorkspaceUserModel } from './workspace-users.model';
import { WorkspaceAttributes } from '../attributes/workspace.attributes';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'workspaces',
})
export class WorkspaceModel extends Model implements WorkspaceAttributes {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  ownerId: string;

  @Column(DataType.STRING)
  address: string;

  @Column(DataType.STRING)
  name: string;

  @Column(DataType.STRING)
  description: string;

  @ForeignKey(() => TeamModel)
  @Column(DataType.UUID)
  defaultTeamId: string;

  @ForeignKey(() => WorkspaceUserModel)
  @Column(DataType.UUID)
  workspaceUserId: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
