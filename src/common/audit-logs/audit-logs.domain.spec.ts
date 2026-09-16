import { v4 } from 'uuid';
import { AuditLog } from './audit-logs.domain';
import {
  AUDIT_ENTITY_ACTIONS,
  AuditAction,
  AuditEntityType,
  AuditPerformerType,
} from './audit-logs.attributes';

const buildAttributes = (entityType: AuditEntityType, action: AuditAction) => ({
  id: v4(),
  entityType,
  entityId: v4(),
  action,
  performerType: AuditPerformerType.User,
  performerId: v4(),
  createdAt: new Date(),
});

describe('AuditLog domain', () => {
  describe('AUDIT_ENTITY_ACTIONS', () => {
    it.each(Object.values(AuditAction))(
      'When the action %s exists, then it should be allowed for at least one entity type',
      (action) => {
        const entityTypes = Object.values(AuditEntityType).filter((type) =>
          AUDIT_ENTITY_ACTIONS[type].includes(action),
        );

        expect(entityTypes.length).toBeGreaterThan(0);
      },
    );
  });

  describe('constructor', () => {
    it.each(
      Object.values(AuditEntityType).flatMap((entityType) =>
        AUDIT_ENTITY_ACTIONS[entityType].map(
          (action) => [entityType, action] as const,
        ),
      ),
    )(
      'When the entity type is %s and the action is %s, then it should create the audit log',
      (entityType, action) => {
        const attributes = buildAttributes(entityType, action);

        const auditLog = new AuditLog(attributes);

        expect(auditLog).toMatchObject(attributes);
      },
    );

    it('When the action is not allowed for the entity type, then it should throw', () => {
      const attributes = buildAttributes(
        AuditEntityType.Workspace,
        AuditAction.PasswordChanged,
      );

      expect(() => new AuditLog(attributes)).toThrow(
        `Invalid combination: action '${AuditAction.PasswordChanged}' is not valid for entityType '${AuditEntityType.Workspace}'`,
      );
    });
  });
});
