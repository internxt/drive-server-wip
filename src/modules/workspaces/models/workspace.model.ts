import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { UserModel } from '../../user/user.model';
import { WorkspaceUserModel } from './workspace-users.model';
import { WorkspaceAttributes } from '../attributes/workspace.attributes';
import { WorkspaceTeamModel } from './workspace-team.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'workspaces',
})
export class WorkspaceModel extends Model implements WorkspaceAttributes {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  ownerId: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'ownerId',
    targetKey: 'uuid',
    as: 'owner',
  })
  owner: UserModel;

  @Column(DataType.STRING)
  address: string;

  @Column(DataType.STRING)
  name: string;

  @Column(DataType.STRING)
  description: string;

  @Column(DataType.BOOLEAN)
  setupCompleted: boolean;

  @ForeignKey(() => WorkspaceTeamModel)
  @Column(DataType.UUID)
  defaultTeamId: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'defaultTeamId',
    targetKey: 'id',
    as: 'defaultTeam',
  })
  defaultTeam: WorkspaceTeamModel;

  @ForeignKey(() => WorkspaceUserModel)
  @Column(DataType.UUID)
  workspaceUserId: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
