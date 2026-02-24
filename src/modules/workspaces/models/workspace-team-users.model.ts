import {
  Table,
  PrimaryKey,
  DataType,
  Column,
  ForeignKey,
  BelongsTo,
  Model,
} from 'sequelize-typescript';
import { UserModel } from '../../user/user.model';
import { WorkspaceTeamModel } from './workspace-team.model';
import { type WorkspaceTeamUserAttributes } from '../attributes/workspace-team-users.attributes';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'workspace_teams_users',
})
export class WorkspaceTeamUserModel
  extends Model
  implements WorkspaceTeamUserAttributes
{
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => WorkspaceTeamModel)
  @Column(DataType.UUID)
  teamId: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  memberId: string;

  @BelongsTo(() => WorkspaceTeamModel, {
    foreignKey: 'teamId',
    targetKey: 'id',
  })
  team: WorkspaceTeamModel;

  @BelongsTo(() => UserModel, {
    foreignKey: 'memberId',
    targetKey: 'uuid',
    as: 'member',
  })
  member: UserModel;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
