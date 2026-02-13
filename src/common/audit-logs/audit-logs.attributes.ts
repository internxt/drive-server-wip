export interface AuditLogAttributes {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  performerType: AuditPerformerType;
  performerId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export enum AuditEntityType {
  User = 'user',
  Workspace = 'workspace',
}

export enum AuditPerformerType {
  User = 'user',
  Gateway = 'gateway',
  System = 'system', // for possible future cron jobs
}

export enum AuditAction {
  // User actions
  StorageChanged = 'storage-changed',
  EmailChanged = 'email-changed',
  PasswordChanged = 'password-changed',
  TfaEnabled = '2fa-enabled',
  TfaDisabled = '2fa-disabled',
  AccountReset = 'account-reset',
  AccountRecovery = 'account-recovery',
  AccountDeactivated = 'account-deactivated',
  // Workspace actions
  WorkspaceCreated = 'workspace-created',
  WorkspaceDeleted = 'workspace-deleted',
  WorkspaceStorageChanged = 'workspace-storage-changed',
  UserLimitOverridden = 'user-limit-overridden',
}

export const AUDIT_ENTITY_ACTIONS: Record<AuditEntityType, AuditAction[]> = {
  [AuditEntityType.User]: [
    AuditAction.StorageChanged,
    AuditAction.EmailChanged,
    AuditAction.PasswordChanged,
    AuditAction.TfaEnabled,
    AuditAction.TfaDisabled,
    AuditAction.AccountReset,
    AuditAction.AccountRecovery,
    AuditAction.AccountDeactivated,
  ],
  [AuditEntityType.Workspace]: [
    AuditAction.WorkspaceCreated,
    AuditAction.WorkspaceDeleted,
    AuditAction.WorkspaceStorageChanged,
  ],
};
