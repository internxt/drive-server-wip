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
  declare id: string;

  @ForeignKey(() => WorkspaceModel)
  @Column(DataType.UUID)
  declare workspaceId: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  declare managerId: string;

  @Column(DataType.STRING)
  declare name: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'managerId',
    targetKey: 'uuid',
    as: 'manager',
  })
  declare manager: UserModel;

  @BelongsTo(() => WorkspaceModel, {
    foreignKey: 'workspaceId',
    targetKey: 'id',
    as: 'workspace',
  })
  declare workspace: WorkspaceModel;

  @HasMany(() => WorkspaceTeamUserModel, 'teamId')
  declare teamUsers: WorkspaceTeamUserModel[];

  @Column(DataType.DATE)
  declare createdAt: Date;

  @Column(DataType.DATE)
  declare updatedAt: Date;
}
