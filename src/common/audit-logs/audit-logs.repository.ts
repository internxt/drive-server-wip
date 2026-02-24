import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuditLogModel } from './audit-logs.model';
import { AuditLog } from './audit-logs.domain';
import { type AuditLogAttributes } from './audit-logs.attributes';

export abstract class AuditLogsRepository {
  abstract create(
    auditLogData: Omit<AuditLogAttributes, 'id' | 'createdAt'>,
  ): Promise<AuditLog>;
}

@Injectable()
export class SequelizeAuditLogRepository implements AuditLogsRepository {
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
    return new AuditLog({
      ...auditLogModel.toJSON(),
    });
  }
}
