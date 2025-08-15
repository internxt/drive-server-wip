import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuditLogModel } from './audit-logs.model';
import { AuditLog } from './audit-logs.domain';
import {
  AuditLogAttributes,
  AuditAction,
  AuditEntityType,
  AuditPerformerType,
} from './audit-logs.attributes';

export interface AuditLogFilters {
  entityType?: AuditEntityType;
  entityId?: string;
  performerType?: AuditPerformerType;
  performerId?: string;
  actions?: AuditAction[];
  dateFrom?: Date;
  dateTo?: Date;
}

@Injectable()
export class SequelizeAuditLogRepository {
  constructor(
    @InjectModel(AuditLogModel)
    private readonly auditLogModel: typeof AuditLogModel,
  ) {}

  async create(
    auditLogData: Omit<AuditLogAttributes, 'id' | 'createdAt'>,
  ): Promise<AuditLog> {
    const auditLog = await this.auditLogModel.create({
      ...auditLogData,
      createdAt: new Date(),
    });

    return this.auditLogToDomain(auditLog);
  }

  private auditLogToDomain(auditLogModel: AuditLogModel): AuditLog {
    return AuditLog.build({
      ...auditLogModel.toJSON(),
      user: auditLogModel.user || undefined,
      workspace: auditLogModel.workspace || undefined,
    });
  }
}
