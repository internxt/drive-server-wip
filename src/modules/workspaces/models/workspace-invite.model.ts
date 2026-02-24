import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { WorkspaceModel } from './workspace.model';
import { type WorkspaceInviteAttributes } from '../attributes/workspace-invite.attribute';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'workspaces_invites',
})
export class WorkspaceInviteModel
  extends Model
  implements WorkspaceInviteAttributes
{
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => WorkspaceModel)
  @Column({ type: DataType.UUID, allowNull: false })
  workspaceId: string;

  @BelongsTo(() => WorkspaceModel, {
    foreignKey: 'workspaceId',
    targetKey: 'id',
    as: 'workspace',
  })
  workspace: WorkspaceModel;

  @Column({ type: DataType.UUID, allowNull: false })
  invitedUser: string;

  @Column({ type: DataType.STRING, allowNull: false })
  encryptionAlgorithm: string;

  @Column({ type: DataType.STRING, allowNull: false })
  encryptionKey: string;

  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false })
  spaceLimit: number;

  @Column({ allowNull: false, defaultValue: DataType.NOW })
  createdAt: Date;

  @Column({ allowNull: false, defaultValue: DataType.NOW })
  updatedAt: Date;
}
