import { Test, type TestingModule } from '@nestjs/testing';
import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { type Logger } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogsRepository } from './audit-logs.repository';
import {
  AuditAction,
  AuditEntityType,
  AuditPerformerType,
} from './audit-logs.attributes';
import { v4 } from 'uuid';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repository: DeepMocked<AuditLogsRepository>;
  let logger: DeepMocked<Logger>;

  beforeEach(async () => {
    logger = createMock<Logger>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditLogService],
    })
      .setLogger(logger)
      .useMocker(() => createMock())
      .compile();

    service = module.get<AuditLogService>(AuditLogService);
    repository = module.get(AuditLogsRepository);
  });

  it('When the service is instantiated, then it should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('When valid audit log data is provided, then it should create an audit log', async () => {
      const auditLogDto = {
        entityType: AuditEntityType.User,
        entityId: v4(),
        action: AuditAction.PasswordChanged,
        performerType: AuditPerformerType.User,
        performerId: v4(),
        metadata: { folderUuid: v4() },
      };

      repository.create.mockResolvedValueOnce({} as any);

      await service.log(auditLogDto);

      expect(repository.create).toHaveBeenCalledWith(auditLogDto);
    });

    it('When valid audit log data without metadata is provided, then it should create an audit log', async () => {
      const auditLogDto = {
        entityType: AuditEntityType.User,
        entityId: v4(),
        action: AuditAction.TfaEnabled,
        performerType: AuditPerformerType.User,
        performerId: v4(),
      };

      repository.create.mockResolvedValueOnce({} as any);

      await service.log(auditLogDto);

      expect(repository.create).toHaveBeenCalledWith(auditLogDto);
    });

    it('When repository throws an error, then it should log a warning and not throw', async () => {
      const auditLogDto = {
        entityType: AuditEntityType.User,
        entityId: v4(),
        action: AuditAction.EmailChanged,
        performerType: AuditPerformerType.User,
        performerId: v4(),
        metadata: { newEmail: 'new@example.com' },
      };

      const error = new Error('Database connection failed');
      repository.create.mockRejectedValueOnce(error);

      const loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation();

      await service.log(auditLogDto);

      expect(repository.create).toHaveBeenCalledWith(auditLogDto);
      expect(loggerWarnSpy).toHaveBeenCalled();
    });
  });
});
