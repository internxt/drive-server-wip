import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  BelongsToMany,
  HasMany,
} from 'sequelize-typescript';
import { WorkspaceModel } from './workspace.model';
import { UserModel } from '../../user/user.model';
import { TeamAttributes } from '../attributes/team.attributes';
import { TeamUserModel } from './team-users.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'workspace_teams',
})
export class TeamModel extends Model implements TeamAttributes {
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

  @HasMany(() => TeamUserModel, 'teamId')
  teamUsers: TeamUserModel[];

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
