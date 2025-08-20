import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  BelongsTo,
} from 'sequelize-typescript';
import { UserModel } from './user.model';
import { WorkspaceModel } from '../workspaces/models/workspace.model';
import {
  AuditLogAttributes,
  AuditAction,
  AuditEntityType,
  AuditPerformerType,
} from './audit-logs.attributes';
import { User } from './user.domain';
import { Workspace } from '../workspaces/domains/workspaces.domain';

@Table({
  underscored: true,
  timestamps: false,
  tableName: 'audit_logs',
})
export class AuditLogModel extends Model implements AuditLogAttributes {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @Column({
    type: DataType.ENUM(...Object.values(AuditEntityType)),
    allowNull: false,
  })
  entityType: AuditEntityType;

  @Column({ type: DataType.UUID, allowNull: false })
  entityId: string;

  @Column({
    type: DataType.ENUM(...Object.values(AuditAction)),
    allowNull: false,
  })
  action: AuditAction;

  @Column({
    type: DataType.ENUM(...Object.values(AuditPerformerType)),
    allowNull: false,
  })
  performerType: AuditPerformerType;

  @Column({ type: DataType.UUID, allowNull: true })
  performerId?: string;

  @Column({ type: DataType.JSONB, allowNull: true })
  metadata?: Record<string, any>;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  createdAt: Date;

  @BelongsTo(() => UserModel, {
    foreignKey: 'entityId',
    targetKey: 'uuid',
    as: 'user',
    constraints: false,
  })
  user?: UserModel;

  @BelongsTo(() => WorkspaceModel, {
    foreignKey: 'entityId',
    targetKey: 'id',
    as: 'workspace',
    constraints: false,
  })
  workspace?: WorkspaceModel;

  @BelongsTo(() => UserModel, {
    foreignKey: 'performerId',
    targetKey: 'uuid',
    as: 'performer',
    constraints: false,
  })
  performer?: UserModel;
}
