import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from '@nestjs/common';
import { AuditLogService, CreateAuditLogDto } from './audit-log.service';
import { AuditLogsRepository } from './audit-logs.repository';
import {
  AuditEntityType,
  AuditAction,
  AuditPerformerType,
} from './audit-logs.attributes';

const baseDto: CreateAuditLogDto = {
  entityType: AuditEntityType.User,
  entityId: 'user-123',
  action: AuditAction.EmailChanged,
  performerType: AuditPerformerType.User,
  performerId: 'performer-456',
  metadata: { ip: '127.0.0.1' },
};

describe('AuditLogService', () => {
  let service: AuditLogService;
  let mockRepository: { create: ReturnType<typeof vi.fn> };
  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    mockRepository = { create: vi.fn() };

    service = new AuditLogService(mockRepository as AuditLogsRepository);

    loggerWarnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  describe('log', () => {
    it('should call repository.create with the provided dto', async () => {
      await service.log(baseDto);

      expect(mockRepository.create).toHaveBeenCalledOnce();
      expect(mockRepository.create).toHaveBeenCalledWith(baseDto);
    });

    it('should not throw when repository.create fails', async () => {
      mockRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(service.log(baseDto)).resolves.toBeUndefined();
    });

    it('should log a warning when repository.create fails', async () => {
      const dbError = new Error('Connection timeout');
      mockRepository.create.mockRejectedValue(dbError);

      await service.log(baseDto);

      expect(loggerWarnSpy).toHaveBeenCalledOnce();
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        {
          action: baseDto.action,
          entityType: baseDto.entityType,
          entityId: baseDto.entityId,
          error: dbError.message,
        },
        'Failed to create audit log',
      );
    });

    it('should include the correct error message in the warning', async () => {
      const specificError = new Error('Unique constraint violation');
      mockRepository.create.mockRejectedValue(specificError);

      await service.log(baseDto);

      const [warnPayload] = loggerWarnSpy.mock.calls[0];
      expect(warnPayload.error).toBe('Unique constraint violation');
    });

    it('should not log a warning when repository.create succeeds', async () => {
      mockRepository.create.mockResolvedValue(undefined);

      await service.log(baseDto);

      expect(loggerWarnSpy).not.toHaveBeenCalled();
    });

    it('should work without optional fields (performerId, metadata)', async () => {
      const minimalDto: CreateAuditLogDto = {
        entityType: AuditEntityType.User,
        entityId: 'user-999',
        action: AuditAction.AccountDeactivated,
        performerType: AuditPerformerType.System,
      };
      mockRepository.create.mockResolvedValue(undefined);

      await expect(service.log(minimalDto)).resolves.toBeUndefined();
      expect(mockRepository.create).toHaveBeenCalledWith(minimalDto);
    });

    it('should work with a Workspace entity and Gateway performer', async () => {
      const workspaceDto: CreateAuditLogDto = {
        entityType: AuditEntityType.Workspace,
        entityId: 'workspace-123',
        action: AuditAction.WorkspaceCreated,
        performerType: AuditPerformerType.Gateway,
        performerId: 'gateway-001',
      };
      mockRepository.create.mockResolvedValue(undefined);

      await expect(service.log(workspaceDto)).resolves.toBeUndefined();
      expect(mockRepository.create).toHaveBeenCalledWith(workspaceDto);
    });
  });
});
