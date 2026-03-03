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
  declare id: string;

  @ForeignKey(() => WorkspaceModel)
  @Column({ type: DataType.UUID, allowNull: false })
  declare workspaceId: string;

  @BelongsTo(() => WorkspaceModel, {
    foreignKey: 'workspaceId',
    targetKey: 'id',
    as: 'workspace',
  })
  declare workspace: WorkspaceModel;

  @Column({ type: DataType.UUID, allowNull: false })
  declare invitedUser: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare encryptionAlgorithm: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare encryptionKey: string;

  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false })
  declare spaceLimit: number;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare createdAt: Date;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare updatedAt: Date;
}
