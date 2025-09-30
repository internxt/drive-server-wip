import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuditLogModel } from './audit-logs.model';
import {
  AuditLogsRepository,
  SequelizeAuditLogRepository,
} from './audit-logs.repository';

@Module({
  imports: [SequelizeModule.forFeature([AuditLogModel])],
  controllers: [],
  providers: [
    {
      provide: AuditLogsRepository,
      useClass: SequelizeAuditLogRepository,
    },
  ],
  exports: [],
})
export class AuditLogsModule {}
