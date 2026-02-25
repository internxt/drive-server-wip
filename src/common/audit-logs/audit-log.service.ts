import { Injectable, Logger } from '@nestjs/common';
import { AuditLogsRepository } from './audit-logs.repository';
import {
  type AuditAction,
  type AuditEntityType,
  type AuditPerformerType,
} from './audit-logs.attributes';

export interface CreateAuditLogDto {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  performerType: AuditPerformerType;
  performerId?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  /**
   * Creates an audit log entry without throwing errors
   * @param dto Audit log data
   */
  async log(dto: CreateAuditLogDto): Promise<void> {
    try {
      await this.auditLogsRepository.create(dto);
    } catch (error) {
      this.logger.warn(
        {
          action: dto.action,
          entityType: dto.entityType,
          entityId: dto.entityId,
          error: (error as Error).message,
        },
        'Failed to create audit log',
      );
    }
  }
}
