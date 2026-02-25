import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { type CallHandler, type ExecutionContext } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import { of, lastValueFrom } from 'rxjs';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { type AuditLogService } from '../audit-log.service';
import { type AuditLogConfig } from '../decorators/audit-log.decorator';
import {
  AuditAction,
  AuditEntityType,
  AuditPerformerType,
} from '../audit-logs.attributes';
import { newUser, newWorkspace } from '../../../../test/fixtures';

describe('AuditLogInterceptor', () => {
  let interceptor: AuditLogInterceptor;
  let reflector: DeepMocked<Reflector>;
  let auditLogService: DeepMocked<AuditLogService>;

  const mockHandler = jest.fn();

  const createContext = (request: any) =>
    createMock<ExecutionContext>({
      getHandler: () => mockHandler,
      switchToHttp: () => ({ getRequest: () => request }),
    });

  const createCallHandler = (response: any): CallHandler => ({
    handle: jest.fn().mockReturnValue(of(response)),
  });

  beforeEach(() => {
    reflector = createMock<Reflector>();
    auditLogService = createMock<AuditLogService>();
    interceptor = new AuditLogInterceptor(reflector, auditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('When the interceptor is instantiated, then it should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('When no audit log metadata is found, then it should pass through without logging', async () => {
      const context = createContext({});
      const next = createCallHandler({ data: 'test' });
      reflector.get.mockReturnValue(undefined);

      const result = await lastValueFrom(interceptor.intercept(context, next));

      expect(result).toEqual({ data: 'test' });
      expect(auditLogService.log).not.toHaveBeenCalled();
    });

    it('When audit log metadata is found with minimal config, then it should create audit log with defaults', async () => {
      const metadata: AuditLogConfig = { action: AuditAction.TfaEnabled };
      const request = { user: newUser() };
      const context = createContext(request);
      const next = createCallHandler({ success: true });

      reflector.get.mockReturnValue(metadata);
      auditLogService.log.mockResolvedValue(undefined);

      await lastValueFrom(interceptor.intercept(context, next));

      expect(auditLogService.log).toHaveBeenCalledWith({
        action: AuditAction.TfaEnabled,
        entityType: AuditEntityType.User,
        entityId: request.user.uuid,
        performerType: AuditPerformerType.User,
        performerId: request.user.uuid,
        metadata: undefined,
      });
    });

    it('When using custom extractors, then it should extract values from paths and callbacks', async () => {
      const metadata: AuditLogConfig = {
        action: AuditAction.WorkspaceCreated,
        entityType: AuditEntityType.Workspace,
        entityId: (_req, res) => res.workspace.id,
        performerId: 'user.uuid',
        performerType: AuditPerformerType.System,
        metadata: ['body.name'],
      };
      const creator = newUser();
      const workspaceCreated = newWorkspace({ owner: creator });

      const request = {
        user: creator,
        body: { name: workspaceCreated.name },
      };
      const response = { workspace: workspaceCreated };
      const context = createContext(request);
      const next = createCallHandler(response);

      reflector.get.mockReturnValue(metadata);
      auditLogService.log.mockResolvedValue(undefined);

      await lastValueFrom(interceptor.intercept(context, next));

      expect(auditLogService.log).toHaveBeenCalledWith({
        action: AuditAction.WorkspaceCreated,
        entityType: AuditEntityType.Workspace,
        entityId: response.workspace.id,
        performerId: request.user.uuid,
        performerType: AuditPerformerType.System,
        metadata: { name: request.body.name },
      });
    });

    it('When entityId cannot be extracted, then it should not create audit log', async () => {
      const metadata: AuditLogConfig = {
        action: AuditAction.EmailChanged,
        entityId: 'user.id',
      };
      const request = { user: {} };
      const context = createContext(request);
      const next = createCallHandler({});

      reflector.get.mockReturnValue(metadata);

      await lastValueFrom(interceptor.intercept(context, next));

      expect(auditLogService.log).not.toHaveBeenCalled();
    });

    it('When audit log creation fails, then it should not throw', async () => {
      const metadata: AuditLogConfig = {
        action: AuditAction.PasswordChanged,
      };
      const request = { user: newUser() };
      const context = createContext(request);
      const next = createCallHandler({});
      const error = new Error('Audit log creation failed');

      reflector.get.mockReturnValue(metadata);
      auditLogService.log.mockRejectedValue(error);

      const result = await lastValueFrom(interceptor.intercept(context, next));

      expect(result).toEqual({});
    });
  });
});
