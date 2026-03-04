import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import {
  type AuditAction,
  type AuditEntityType,
  type AuditPerformerType,
} from '../audit-logs.attributes';
import { AuditLogInterceptor } from '../interceptors/audit-log.interceptor';

export type ValueExtractor<T = any> =
  | string
  | ((req: any, res: any) => T | undefined);

export interface AuditLogConfig {
  action: AuditAction;

  /**
   * The type of entity being audited (defaults to User)
   */
  entityType?: AuditEntityType;

  /**
   * Path or callback to extract the entity ID
   * Examples:
   * - 'user.uuid' - extracts from req.user.uuid
   * - 'params.userId' - extracts from req.params.userId
   * - (req, res) => res.workspace.id - custom extraction
   *
   * Defaults to 'user.uuid' if not specified
   */
  entityId?: ValueExtractor<string>;

  /**
   * Path or callback to extract the performer ID
   * Defaults to 'user.uuid' if not specified
   */
  performerId?: ValueExtractor<string>;

  performerType?: AuditPerformerType;

  metadata?:
    | string[]
    | ((req: any, res: any) => Record<string, any> | undefined);
}

export const AUDIT_LOG_METADATA_KEY = 'audit-log';

/**
 * Decorator to mark controller methods for automatic audit logging
 *
 * @param config Configuration for audit logging
 *
 * @example
 * // Minimal usage - auto-detects entityId from user.uuid
 * @AuditLog({ action: AuditAction.TfaEnabled })
 *
 * @example
 * // With string paths for data extraction
 * @AuditLog({
 *   action: AuditAction.EmailChanged,
 *   entityId: 'user.uuid',
 *   metadata: ['body.newEmail', 'body.oldEmail']
 * })
 *
 * @example
 * // With callback functions for complex extraction
 * @AuditLog({
 *   action: AuditAction.WorkspaceCreated,
 *   entityType: AuditEntityType.Workspace,
 *   entityId: (req, res) => res.workspace.id,
 *   performerId: 'user.uuid',
 *   metadata: (req, res) => ({
 *     workspaceName: res.workspace.name,
 *     ownerId: res.workspace.ownerId
 *   })
 * })
 */
export const AuditLog = (config: AuditLogConfig) =>
  applyDecorators(
    SetMetadata(AUDIT_LOG_METADATA_KEY, config),
    UseInterceptors(AuditLogInterceptor),
  );
