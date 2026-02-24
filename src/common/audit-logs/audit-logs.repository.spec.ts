import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { SequelizeAuditLogRepository } from './audit-logs.repository';
import { AuditLogModel } from './audit-logs.model';
import { AuditLog } from './audit-logs.domain';
import {
  AuditLogAttributes,
  AuditEntityType,
  AuditAction,
  AuditPerformerType,
} from './audit-logs.attributes';

const createMockAuditLogInstance = (
  overrides: Partial<AuditLogAttributes> = {},
) => {
  const base: AuditLogAttributes = {
    id: 'audit-id-123',
    entityType: AuditEntityType.User,
    entityId: 'entity-456',
    action: AuditAction.EmailChanged,
    performerType: AuditPerformerType.User,
    performerId: 'performer-789',
    metadata: { ip: '127.0.0.1' },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };

  return {
    ...base,
    toJSON: vi.fn().mockReturnValue(base),
  };
};

const userAuditLogData: Omit<AuditLogAttributes, 'id' | 'createdAt'> = {
  entityType: AuditEntityType.User,
  entityId: 'user-456',
  action: AuditAction.EmailChanged,
  performerType: AuditPerformerType.User,
  performerId: 'performer-789',
  metadata: { ip: '127.0.0.1' },
};

const workspaceAuditLogData: Omit<AuditLogAttributes, 'id' | 'createdAt'> = {
  entityType: AuditEntityType.Workspace,
  entityId: 'workspace-123',
  action: AuditAction.WorkspaceCreated,
  performerType: AuditPerformerType.Gateway,
  performerId: 'gateway-001',
};

describe('SequelizeAuditLogRepository', () => {
  let repository: SequelizeAuditLogRepository;
  let mockAuditLogModel: { create: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockAuditLogModel = { create: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SequelizeAuditLogRepository,
        {
          provide: getModelToken(AuditLogModel),
          useValue: mockAuditLogModel,
        },
      ],
    }).compile();

    repository = module.get<SequelizeAuditLogRepository>(
      SequelizeAuditLogRepository,
    );
  });

  describe('create', () => {
    it('should return an AuditLog domain instance', async () => {
      mockAuditLogModel.create.mockResolvedValue(createMockAuditLogInstance());

      const result = await repository.create(userAuditLogData);

      expect(result).toBeInstanceOf(AuditLog);
    });

    it('should call model.create with provided fields and an auto-generated createdAt', async () => {
      mockAuditLogModel.create.mockResolvedValue(createMockAuditLogInstance());

      await repository.create(userAuditLogData);

      expect(mockAuditLogModel.create).toHaveBeenCalledOnce();
      expect(mockAuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: AuditEntityType.User,
          entityId: 'user-456',
          action: AuditAction.EmailChanged,
          performerType: AuditPerformerType.User,
          performerId: 'performer-789',
          metadata: { ip: '127.0.0.1' },
          createdAt: expect.any(Date),
        }),
      );
    });

    it('should handle a Workspace entity with a Gateway performer', async () => {
      mockAuditLogModel.create.mockResolvedValue(
        createMockAuditLogInstance({
          entityType: AuditEntityType.Workspace,
          entityId: 'workspace-123',
          action: AuditAction.WorkspaceCreated,
          performerType: AuditPerformerType.Gateway,
          performerId: 'gateway-001',
          metadata: undefined,
        }),
      );

      const result = await repository.create(workspaceAuditLogData);

      expect(result).toBeInstanceOf(AuditLog);
      expect(mockAuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: AuditEntityType.Workspace,
          action: AuditAction.WorkspaceCreated,
          performerType: AuditPerformerType.Gateway,
        }),
      );
    });

    it('should handle a System performer without performerId or metadata', async () => {
      const systemData: Omit<AuditLogAttributes, 'id' | 'createdAt'> = {
        entityType: AuditEntityType.User,
        entityId: 'user-999',
        action: AuditAction.AccountDeactivated,
        performerType: AuditPerformerType.System,
      };

      mockAuditLogModel.create.mockResolvedValue(
        createMockAuditLogInstance({
          action: AuditAction.AccountDeactivated,
          performerType: AuditPerformerType.System,
          performerId: undefined,
          metadata: undefined,
        }),
      );

      const result = await repository.create(systemData);

      expect(result).toBeInstanceOf(AuditLog);
      expect(mockAuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: AuditEntityType.User,
          action: AuditAction.AccountDeactivated,
          performerType: AuditPerformerType.System,
          createdAt: expect.any(Date),
        }),
      );
    });

    it('should map all model fields to the domain object via toJSON', async () => {
      const expected: AuditLogAttributes = {
        id: 'audit-id-999',
        entityType: AuditEntityType.User,
        entityId: 'user-abc',
        action: AuditAction.PasswordChanged,
        performerType: AuditPerformerType.User,
        performerId: 'performer-xyz',
        metadata: { reason: 'user request' },
        createdAt: new Date('2024-06-15T12:00:00Z'),
      };

      const mockInstance = createMockAuditLogInstance(expected);
      mockAuditLogModel.create.mockResolvedValue(mockInstance);

      const result = await repository.create({
        entityType: expected.entityType,
        entityId: expected.entityId,
        action: expected.action,
        performerType: expected.performerType,
        performerId: expected.performerId,
        metadata: expected.metadata,
      });

      expect(mockInstance.toJSON).toHaveBeenCalled();
      expect(result).toMatchObject(expected);
    });

    it('should generate a createdAt timestamp within the call time window', async () => {
      mockAuditLogModel.create.mockResolvedValue(createMockAuditLogInstance());

      const before = new Date();
      await repository.create(userAuditLogData);
      const after = new Date();

      const [callArg] = mockAuditLogModel.create.mock.calls[0];
      expect(callArg.createdAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(callArg.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should propagate errors thrown by model.create', async () => {
      mockAuditLogModel.create.mockRejectedValue(new Error('Database error'));

      await expect(repository.create(userAuditLogData)).rejects.toThrow(
        'Database error',
      );
    });
  });
});
