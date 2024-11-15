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
import { WorkspaceLogAttributes } from '../attributes/workspace-logs.attributes';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'workspace_logs',
})
export class WorkspaceLogModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false })
  creator: string;

  @BelongsTo(() => UserModel, {
    foreignKey: 'creator',
    targetKey: 'uuid',
    as: 'user',
  })
  user: UserModel;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  type: WorkspaceLogAttributes['type'];

  @Column(DataType.STRING)
  entity: string;

  @Column(DataType.STRING)
  entityId: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
