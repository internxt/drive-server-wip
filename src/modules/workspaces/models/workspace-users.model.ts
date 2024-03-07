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
import { WorkspaceModel } from './workspace.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'workspace_users',
})
export class WorkspaceUserModel extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  memberId: string;

  @Column(DataType.STRING)
  key: string;

  @ForeignKey(() => WorkspaceModel)
  @Column(DataType.UUID)
  workspaceId: string;

  @Column(DataType.DOUBLE)
  spaceLimit: number;

  @Column(DataType.DOUBLE)
  driveUsage: number;

  @Column(DataType.DOUBLE)
  backupsUsage: number;

  @Column(DataType.BOOLEAN)
  deactivated: boolean;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
