import type { WorkspaceModel } from '../workspaces/models/workspace.model';
import type { UserModel } from './user.model';

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
  // Workspace actions
  WorkspaceCreated = 'workspace-created',
  WorkspaceDeleted = 'workspace-deleted',
  WorkspaceStorageChanged = 'workspace-storage-changed',
}

export interface AuditLogAttributes {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  performerType: AuditPerformerType;
  performerId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  user?: UserModel;
  workspace?: WorkspaceModel;
}
