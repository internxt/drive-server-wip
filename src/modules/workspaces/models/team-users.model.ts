import { Model } from 'sequelize';
import {
  Table,
  PrimaryKey,
  Default,
  DataType,
  Column,
  ForeignKey,
} from 'sequelize-typescript';
import { UserModel } from '../../user/user.model';
import { TeamModel } from './team.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'teams_users',
})
export class TeamUserModel extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => TeamModel)
  @Column(DataType.UUID)
  teamId: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  memberId: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
