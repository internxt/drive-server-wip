import {
  Table,
  PrimaryKey,
  Default,
  DataType,
  Column,
  ForeignKey,
  BelongsTo,
  Model,
} from 'sequelize-typescript';
import { UserModel } from '../../user/user.model';
import { TeamModel } from './team.model';
import { TeamUserAttributes } from '../attributes/team-users.attributes';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'teams_users',
})
export class TeamUserModel extends Model implements TeamUserAttributes {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => TeamModel)
  @Column(DataType.UUID)
  teamId: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  memberId: string;

  @BelongsTo(() => TeamModel, {
    foreignKey: 'teamId',
    targetKey: 'id',
  })
  team: TeamModel;

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
