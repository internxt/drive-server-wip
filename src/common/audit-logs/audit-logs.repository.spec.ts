import { Test, type TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { getModelToken } from '@nestjs/sequelize';
import { SequelizeAuditLogRepository } from './audit-logs.repository';
import { AuditLogModel } from './audit-logs.model';
import {
  AuditAction,
  AuditEntityType,
  AuditPerformerType,
} from './audit-logs.attributes';
import { newAuditLog, newUser } from '../../../test/fixtures';

describe('SequelizeAuditLogRepository', () => {
  let repository: SequelizeAuditLogRepository;
  let auditLogModel: typeof AuditLogModel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizeAuditLogRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get<SequelizeAuditLogRepository>(
      SequelizeAuditLogRepository,
    );
    auditLogModel = module.get<typeof AuditLogModel>(
      getModelToken(AuditLogModel),
    );
  });

  describe('create', () => {
    it('When valid audit log data is provided, then it should create and return an audit log', async () => {
      const user = newUser();
      const auditLogData = newAuditLog({
        entityType: AuditEntityType.User,
        entityId: user.uuid,
        action: AuditAction.PasswordChanged,
        performerType: AuditPerformerType.User,
        performerId: user.uuid,
      });

      jest.spyOn(auditLogModel, 'create').mockResolvedValueOnce({
        toJSON: jest.fn().mockReturnValue({ ...auditLogData }),
      } as any);

      const result = await repository.create(auditLogData);

      expect(auditLogModel.create).toHaveBeenCalledWith({
        ...auditLogData,
        createdAt: expect.any(Date),
      });
      expect(result.entityId).toBe(user.uuid);
      expect(result.action).toBe(AuditAction.PasswordChanged);
      expect(result.performerId).toBe(user.uuid);
    });
  });
});
