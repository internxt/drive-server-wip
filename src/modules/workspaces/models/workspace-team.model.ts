import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { WorkspaceModel } from './workspace.model';
import { UserModel } from '../../user/user.model';
import { WorkspaceTeamUserModel } from './workspace-team-users.model';
import { type WorkspaceTeamAttributes } from '../attributes/workspace-team.attributes';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'workspace_teams',
})
export class WorkspaceTeamModel
  extends Model
  implements WorkspaceTeamAttributes
{
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => WorkspaceModel)
  @Column(DataType.UUID)
  workspaceId: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  managerId: string;

  @Column(DataType.STRING)
  name: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'managerId',
    targetKey: 'uuid',
    as: 'manager',
  })
  manager: UserModel;

  @BelongsTo(() => WorkspaceModel, {
    foreignKey: 'workspaceId',
    targetKey: 'id',
    as: 'workspace',
  })
  workspace: WorkspaceModel;

  @HasMany(() => WorkspaceTeamUserModel, 'teamId')
  teamUsers: WorkspaceTeamUserModel[];

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
