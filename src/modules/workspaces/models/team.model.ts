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
import { TeamAttributes } from '../attributes/team.attributes';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'teams',
})
export class TeamModel extends Model implements TeamAttributes {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => WorkspaceModel)
  @Column(DataType.UUID)
  workspaceId: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  managerId: string;

  @Column(DataType.STRING)
  name: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
