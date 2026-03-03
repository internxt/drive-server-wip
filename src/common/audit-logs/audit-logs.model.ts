import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
} from 'sequelize-typescript';
import {
  type AuditLogAttributes,
  AuditAction,
  AuditEntityType,
  AuditPerformerType,
} from './audit-logs.attributes';

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
}
