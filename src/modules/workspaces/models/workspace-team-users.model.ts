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
  declare id: string;

  @ForeignKey(() => WorkspaceTeamModel)
  @Column(DataType.UUID)
  declare teamId: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  declare memberId: string;

  @BelongsTo(() => WorkspaceTeamModel, {
    foreignKey: 'teamId',
    targetKey: 'id',
  })
  declare team: WorkspaceTeamModel;

  @BelongsTo(() => UserModel, {
    foreignKey: 'memberId',
    targetKey: 'uuid',
    as: 'member',
  })
  declare member: UserModel;

  @Column(DataType.DATE)
  declare createdAt: Date;

  @Column(DataType.DATE)
  declare updatedAt: Date;
}
