import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuditLogModel } from './audit-logs.model';
import {
  AuditLogsRepository,
  SequelizeAuditLogRepository,
} from './audit-logs.repository';
import { AuditLogService } from './audit-log.service';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';

@Module({
  imports: [SequelizeModule.forFeature([AuditLogModel])],
  controllers: [],
  providers: [
    {
      provide: AuditLogsRepository,
      useClass: SequelizeAuditLogRepository,
    },
    AuditLogService,
    AuditLogInterceptor,
  ],
  exports: [AuditLogService, AuditLogInterceptor, AuditLogsRepository],
})
export class AuditLogsModule {}
