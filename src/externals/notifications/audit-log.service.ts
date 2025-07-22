import { Injectable } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { AuditActionEvent } from './events/audit-log.event';
import { User } from '../../modules/user/user.domain';
import {
  AuditAction,
  AuditEntityType,
  AuditPerformerType,
} from '../../modules/user/audit-logs.attributes';

@Injectable()
export class AuditLogService {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Log a generic activity action by emitting an event
   * @param entityType - The type of entity (user, workspace)
   * @param entityId - The ID of the entity
   * @param action - The action that was performed
   * @param performerType - Who performed the action (user, gateway, system)
   * @param performerId - The ID of the performer
   * @param metadata - Optional metadata to include
   */
  logActivity(
    entityType: AuditEntityType,
    entityId: string,
    action: AuditAction,
    performerType: AuditPerformerType,
    performerId?: string,
    metadata?: Record<string, any>,
  ): void {
    const event = new AuditActionEvent(
      entityType,
      entityId,
      action,
      performerType,
      performerId,
      metadata,
    );
    this.notificationService.add(event);
  }

  /**
   * Log a user action performed by the user themselves
   * @param user - The user who performed the action
   * @param action - The action that was performed
   * @param metadata - Optional metadata to include
   */
  logUserAction(
    user: User,
    action: AuditAction,
    metadata?: Record<string, any>,
  ): void {
    this.logActivity(
      AuditEntityType.User,
      user.uuid,
      action,
      AuditPerformerType.User,
      user.uuid,
      metadata,
    );
  }

  /**
   * Log a user action performed by the gateway
   * @param user - The user affected by the action
   * @param action - The action that was performed
   * @param metadata - Optional metadata to include
   */
  logGatewayUserAction(
    user: User,
    action: AuditAction,
    metadata?: Record<string, any>,
  ): void {
    this.logActivity(
      AuditEntityType.User,
      user.uuid,
      action,
      AuditPerformerType.Gateway,
      undefined,
      metadata,
    );
  }

  /**
   * Log a workspace action
   * @param workspaceId - The workspace ID
   * @param action - The action that was performed
   * @param performerType - Who performed the action
   * @param performerId - The ID of the performer
   * @param metadata - Optional metadata to include
   */
  logWorkspaceAction(
    workspaceId: string,
    action: AuditAction,
    performerType: AuditPerformerType,
    performerId?: string,
    metadata?: Record<string, any>,
  ): void {
    this.logActivity(
      AuditEntityType.Workspace,
      workspaceId,
      action,
      performerType,
      performerId,
      metadata,
    );
  }

  /**
   * Log storage changed action
   */
  logStorageChanged(user: User, maxSpaceBytes?: number): void {
    this.logUserAction(
      user,
      AuditAction.StorageChanged,
      maxSpaceBytes ? { maxSpaceBytes } : undefined,
    );
  }

  /**
   * Log email changed action
   */
  logEmailChanged(user: User): void {
    this.logUserAction(user, AuditAction.EmailChanged);
  }

  /**
   * Log password changed action
   */
  logPasswordChanged(user: User): void {
    this.logUserAction(user, AuditAction.PasswordChanged);
  }

  /**
   * Log 2FA enabled action
   */
  logTfaEnabled(user: User): void {
    this.logUserAction(user, AuditAction.TfaEnabled);
  }

  /**
   * Log 2FA disabled action
   */
  logTfaDisabled(user: User): void {
    this.logUserAction(user, AuditAction.TfaDisabled);
  }

  /**
   * Log account reset action
   */
  logAccountReset(user: User): void {
    this.logUserAction(user, AuditAction.AccountReset);
  }

  /**
   * Log account recovery action
   */
  logAccountRecovery(user: User): void {
    this.logUserAction(user, AuditAction.AccountRecovery);
  }
}
