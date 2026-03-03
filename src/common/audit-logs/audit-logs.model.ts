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
  declare id: string;

  @Column({
    type: DataType.ENUM(...Object.values(AuditEntityType)),
    allowNull: false,
  })
  declare entityType: AuditEntityType;

  @Column({ type: DataType.UUID, allowNull: false })
  declare entityId: string;

  @Column({
    type: DataType.ENUM(...Object.values(AuditAction)),
    allowNull: false,
  })
  declare action: AuditAction;

  @Column({
    type: DataType.ENUM(...Object.values(AuditPerformerType)),
    allowNull: false,
  })
  declare performerType: AuditPerformerType;

  @Column({ type: DataType.UUID, allowNull: true })
  declare performerId?: string;

  @Column({ type: DataType.JSONB, allowNull: true })
  declare metadata?: Record<string, any>;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare createdAt: Date;
}
