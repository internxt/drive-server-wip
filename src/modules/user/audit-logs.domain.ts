import {
  AuditLogAttributes,
  AuditAction,
  AuditEntityType,
  AuditPerformerType,
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

  static build(activityLog: AuditLogAttributes): AuditLog {
    return new AuditLog(activityLog);
  }

  isUserAction(): boolean {
    return this.entityType === AuditEntityType.User;
  }

  isWorkspaceAction(): boolean {
    return this.entityType === AuditEntityType.Workspace;
  }

  isPerformedByUser(): boolean {
    return this.performerType === AuditPerformerType.User;
  }

  isPerformedByGateway(): boolean {
    return this.performerType === AuditPerformerType.Gateway;
  }

  isPerformedBySystem(): boolean {
    return this.performerType === AuditPerformerType.System;
  }

  toJSON() {
    return {
      id: this.id,
      entityType: this.entityType,
      entityId: this.entityId,
      action: this.action,
      performerType: this.performerType,
      performerId: this.performerId,
      metadata: this.metadata,
      createdAt: this.createdAt,
    };
  }
}
