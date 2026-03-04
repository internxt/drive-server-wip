import {
  type AuditLogAttributes,
  type AuditAction,
  type AuditPerformerType,
  type AuditEntityType,
  AUDIT_ENTITY_ACTIONS,
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
    this.validateEntityTypeActionCombination(
      attributes.entityType,
      attributes.action,
    );
    Object.assign(this, attributes);
  }

  private validateEntityTypeActionCombination(
    entityType: AuditEntityType,
    action: AuditAction,
  ): void {
    const allowedActions = AUDIT_ENTITY_ACTIONS[entityType];

    if (!allowedActions.includes(action)) {
      throw new Error(
        `Invalid combination: action '${action}' is not valid for entityType '${entityType}'`,
      );
    }
  }
}
