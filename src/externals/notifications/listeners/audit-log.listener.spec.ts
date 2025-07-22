import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Logger } from '@nestjs/common';
import { AuditLogListener } from './audit-log.listener';
import { SequelizeAuditLogRepository } from '../../../modules/user/audit-logs.repository';
import { AuditActionEvent } from '../events/audit-log.event';
import {
  AuditAction,
  AuditEntityType,
  AuditPerformerType,
} from '../../../modules/user/audit-logs.attributes';
import { AuditLog } from '../../../modules/user/audit-logs.domain';
import { newUser, newAuditLog } from '../../../../test/fixtures';

describe('AuditLogListener', () => {
  let listener: AuditLogListener;
  let auditLogRepository: SequelizeAuditLogRepository;
  let loggerMock: DeepMocked<Logger>;

  beforeEach(async () => {
    loggerMock = createMock<Logger>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditLogListener],
    })
      .setLogger(loggerMock)
      .useMocker(createMock)
      .compile();

    listener = module.get<AuditLogListener>(AuditLogListener);
    auditLogRepository = module.get<SequelizeAuditLogRepository>(
      SequelizeAuditLogRepository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleAuditAction', () => {
    it('When AuditActionEvent is received, then it should create an audit log and log success', async () => {
      const user = newUser();
      const action = AuditAction.PasswordChanged;
      const event = new AuditActionEvent(
        AuditEntityType.User,
        user.uuid,
        action,
        AuditPerformerType.User,
        user.uuid,
      );

      const mockAuditLog = newAuditLog({
        entityType: AuditEntityType.User,
        entityId: user.uuid,
        action,
        performerType: AuditPerformerType.User,
        performerId: user.uuid,
      });

      jest.spyOn(auditLogRepository, 'create').mockResolvedValue(mockAuditLog);
      const logSpy = jest.spyOn(loggerMock, 'log');

      await listener.handleAuditAction(event);

      expect(auditLogRepository.create).toHaveBeenCalledWith({
        entityType: AuditEntityType.User,
        entityId: user.uuid,
        action,
        performerType: AuditPerformerType.User,
        performerId: user.uuid,
        metadata: undefined,
      });
      expect(logSpy).toHaveBeenCalledWith(
        {
          user: user.uuid,
          id: 'AUDIT_LOGGED',
          entity: {
            entityType: AuditEntityType.User,
            action,
            performerType: AuditPerformerType.User,
          },
          message: `Audit '${action}' logged successfully for ${AuditEntityType.User}:${user.uuid}`,
        },
        'AuditLogListener',
      );
    });

    it('When repository throws an error, then it should log the error and not throw', async () => {
      const user = newUser();
      const action = AuditAction.EmailChanged;
      const event = new AuditActionEvent(
        AuditEntityType.User,
        user.uuid,
        action,
        AuditPerformerType.User,
        user.uuid,
      );
      const error = new Error('Database connection failed');

      jest.spyOn(auditLogRepository, 'create').mockRejectedValue(error);
      const errorSpy = jest.spyOn(loggerMock, 'error');

      await listener.handleAuditAction(event);

      expect(auditLogRepository.create).toHaveBeenCalledWith({
        entityType: AuditEntityType.User,
        entityId: user.uuid,
        action,
        performerType: AuditPerformerType.User,
        performerId: user.uuid,
        metadata: undefined,
      });
      expect(errorSpy).toHaveBeenCalled();
      const errorCall = errorSpy.mock.calls[0][0];
      expect(errorCall).toMatchObject({
        user: user.uuid,
        id: 'AUDIT_LOG_ERROR',
        entity: {
          entityType: AuditEntityType.User,
          action,
          performerType: AuditPerformerType.User,
        },
      });
      expect(errorCall.message).toContain('Failed to log audit');
    });

    it('When different action types are received, then it should handle them all correctly', async () => {
      const user = newUser();
      const actions = [
        AuditAction.TfaEnabled,
        AuditAction.TfaDisabled,
        AuditAction.AccountReset,
        AuditAction.StorageChanged,
      ];

      jest
        .spyOn(auditLogRepository, 'create')
        .mockResolvedValue({} as AuditLog);

      for (const action of actions) {
        const event = new AuditActionEvent(
          AuditEntityType.User,
          user.uuid,
          action,
          AuditPerformerType.User,
          user.uuid,
        );
        await listener.handleAuditAction(event);
      }

      expect(auditLogRepository.create).toHaveBeenCalledTimes(actions.length);
      actions.forEach((action) => {
        expect(auditLogRepository.create).toHaveBeenCalledWith({
          entityType: AuditEntityType.User,
          entityId: user.uuid,
          action,
          performerType: AuditPerformerType.User,
          performerId: user.uuid,
          metadata: undefined,
        });
      });
    });

    it('When multiple events are received for same user, then it should process them all', async () => {
      const user = newUser();
      const events = [
        new AuditActionEvent(
          AuditEntityType.User,
          user.uuid,
          AuditAction.PasswordChanged,
          AuditPerformerType.User,
          user.uuid,
        ),
        new AuditActionEvent(
          AuditEntityType.User,
          user.uuid,
          AuditAction.EmailChanged,
          AuditPerformerType.User,
          user.uuid,
        ),
        new AuditActionEvent(
          AuditEntityType.User,
          user.uuid,
          AuditAction.TfaEnabled,
          AuditPerformerType.User,
          user.uuid,
        ),
      ];

      jest
        .spyOn(auditLogRepository, 'create')
        .mockResolvedValue({} as AuditLog);

      for (const event of events) {
        await listener.handleAuditAction(event);
      }

      expect(auditLogRepository.create).toHaveBeenCalledTimes(3);
      expect(auditLogRepository.create).toHaveBeenCalledWith({
        entityType: AuditEntityType.User,
        entityId: user.uuid,
        action: AuditAction.PasswordChanged,
        performerType: AuditPerformerType.User,
        performerId: user.uuid,
        metadata: undefined,
      });
      expect(auditLogRepository.create).toHaveBeenCalledWith({
        entityType: AuditEntityType.User,
        entityId: user.uuid,
        action: AuditAction.EmailChanged,
        performerType: AuditPerformerType.User,
        performerId: user.uuid,
        metadata: undefined,
      });
      expect(auditLogRepository.create).toHaveBeenCalledWith({
        entityType: AuditEntityType.User,
        entityId: user.uuid,
        action: AuditAction.TfaEnabled,
        performerType: AuditPerformerType.User,
        performerId: user.uuid,
        metadata: undefined,
      });
    });
  });
});
