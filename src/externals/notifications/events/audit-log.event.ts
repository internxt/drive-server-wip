import {
  AuditAction,
  AuditEntityType,
  AuditPerformerType,
} from '../../../modules/user/audit-logs.attributes';
import { Event } from './event';

export class AuditActionEvent extends Event {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  performerType: AuditPerformerType;
  performerId?: string;
  metadata?: Record<string, any>;

  constructor(
    entityType: AuditEntityType,
    entityId: string,
    action: AuditAction,
    performerType: AuditPerformerType,
    performerId?: string,
    metadata?: Record<string, any>,
  ) {
    super(AuditActionEvent.id, {
      entityType,
      entityId,
      action,
      performerType,
      performerId,
      metadata,
    });
    this.entityType = entityType;
    this.entityId = entityId;
    this.action = action;
    this.performerType = performerType;
    this.performerId = performerId;
    this.metadata = metadata;
  }

  static get id(): string {
    return 'audit.logged';
  }
}
