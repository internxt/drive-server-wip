import {
  AuditLogAttributes,
  AuditAction,
  AuditPerformerType,
  AuditEntityType,
} from './audit-logs.attributes';

export class AuditLog implements AuditLogAttributes {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  performerType: AuditPerformerType;
  performerId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;

  constructor(attributes: AuditLogAttributes) {
    Object.assign(this, attributes);
  }
}
