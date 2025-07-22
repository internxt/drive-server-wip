import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditActionEvent } from '../events/audit-log.event';
import { SequelizeAuditLogRepository } from '../../../modules/user/audit-logs.repository';

@Injectable()
export class AuditLogListener {
  private readonly logger = new Logger(AuditLogListener.name);

  constructor(
    private readonly auditLogRepository: SequelizeAuditLogRepository,
  ) {}

  @OnEvent(AuditActionEvent.id)
  async handleAuditAction(event: AuditActionEvent) {
    try {
      await this.auditLogRepository.create({
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        performerType: event.performerType,
        performerId: event.performerId,
        metadata: event.metadata,
      });

      this.logger.log({
        user: event.entityId,
        id: 'AUDIT_LOGGED',
        entity: {
          entityType: event.entityType,
          action: event.action,
          performerType: event.performerType,
        },
        message: `Audit '${event.action}' logged successfully for ${event.entityType}:${event.entityId}`,
      });
    } catch (error) {
      this.logger.error({
        user: event.entityId,
        id: 'AUDIT_LOG_ERROR',
        entity: {
          entityType: event.entityType,
          action: event.action,
          performerType: event.performerType,
        },
        message: `Failed to log audit '${event.action}' for ${event.entityType}:${event.entityId}: ${error.message}`,
        stack: error.stack,
      });
    }
  }
}
