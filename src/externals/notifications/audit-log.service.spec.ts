import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';
import { AuditActionEvent } from './events/audit-log.event';
import { AuditAction } from '../../modules/user/audit-logs.attributes';
import { newUser } from '../../../test/fixtures';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let notificationService: NotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditLogService],
    })
      .useMocker(createMock)
      .compile();

    service = module.get<AuditLogService>(AuditLogService);
    notificationService = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logUserAction', () => {
    it('When user and action are provided, then it should emit a UserActionEvent', () => {
      const user = newUser();
      const action = AuditAction.PasswordChanged;

      service.logUserAction(user, action);

      expect(notificationService.add).toHaveBeenCalledWith(
        expect.any(AuditActionEvent),
      );
    });
  });

  describe('logStorageChanged', () => {
    it('When user is provided, then it should log storage changed action', () => {
      const user = newUser();
      jest.spyOn(service, 'logUserAction');

      service.logStorageChanged(user);

      expect(service.logUserAction).toHaveBeenCalledWith(
        user,
        AuditAction.StorageChanged,
        undefined,
      );
    });

    it('When user and maxSpaceBytes are provided, then it should log storage changed action with metadata', () => {
      const user = newUser();
      const maxSpaceBytes = 1000000;
      jest.spyOn(service, 'logUserAction');

      service.logStorageChanged(user, maxSpaceBytes);

      expect(service.logUserAction).toHaveBeenCalledWith(
        user,
        AuditAction.StorageChanged,
        { maxSpaceBytes },
      );
    });
  });

  describe('logEmailChanged', () => {
    it('When user is provided, then it should log email changed action', () => {
      const user = newUser();
      jest.spyOn(service, 'logUserAction');

      service.logEmailChanged(user);

      expect(service.logUserAction).toHaveBeenCalledWith(
        user,
        AuditAction.EmailChanged,
      );
    });
  });

  describe('logPasswordChanged', () => {
    it('When user is provided, then it should log password changed action', () => {
      const user = newUser();
      jest.spyOn(service, 'logUserAction');

      service.logPasswordChanged(user);

      expect(service.logUserAction).toHaveBeenCalledWith(
        user,
        AuditAction.PasswordChanged,
      );
    });
  });

  describe('logTfaEnabled', () => {
    it('When user is provided, then it should log 2FA enabled action', () => {
      const user = newUser();
      jest.spyOn(service, 'logUserAction');

      service.logTfaEnabled(user);

      expect(service.logUserAction).toHaveBeenCalledWith(
        user,
        AuditAction.TfaEnabled,
      );
    });
  });

  describe('logTfaDisabled', () => {
    it('When user is provided, then it should log 2FA disabled action', () => {
      const user = newUser();
      jest.spyOn(service, 'logUserAction');

      service.logTfaDisabled(user);

      expect(service.logUserAction).toHaveBeenCalledWith(
        user,
        AuditAction.TfaDisabled,
      );
    });
  });

  describe('logAccountReset', () => {
    it('When user is provided, then it should log account reset action', () => {
      const user = newUser();
      jest.spyOn(service, 'logUserAction');

      service.logAccountReset(user);

      expect(service.logUserAction).toHaveBeenCalledWith(
        user,
        AuditAction.AccountReset,
      );
    });
  });

  describe('logAccountRecovery', () => {
    it('When user is provided, then it should log account recovery action', () => {
      const user = newUser();
      jest.spyOn(service, 'logUserAction');

      service.logAccountRecovery(user);

      expect(service.logUserAction).toHaveBeenCalledWith(
        user,
        AuditAction.AccountRecovery,
      );
    });
  });
});
