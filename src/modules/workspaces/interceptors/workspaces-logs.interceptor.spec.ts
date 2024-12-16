import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { WorkspacesLogsInterceptor } from './workspaces-logs.interceptor';
import { SequelizeWorkspaceRepository } from '../repositories/workspaces.repository';
import {
  WorkspaceLogType,
  WorkspaceLogPlatform,
} from '../attributes/workspace-logs.attributes';
import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { of } from 'rxjs';
import { WorkspaceItemType } from '../attributes/workspace-items-users.attributes';

describe('WorkspacesLogsInterceptor', () => {
  let interceptor: WorkspacesLogsInterceptor;
  let workspaceRepository: DeepMocked<SequelizeWorkspaceRepository>;
  const loggerDebugSpy = jest.spyOn(Logger, 'debug').mockImplementation();

  beforeEach(async () => {
    workspaceRepository = createMock<SequelizeWorkspaceRepository>();
    interceptor = new WorkspacesLogsInterceptor(workspaceRepository);
    jest.clearAllMocks();
  });

  describe('determinePlatform()', () => {
    it('When client is drive-web, then it should return WEB platform', () => {
      const platform = interceptor.determinePlatform('drive-web');
      expect(platform).toBe(WorkspaceLogPlatform.WEB);
    });

    it('When client is drive-mobile, then it should return MOBILE platform', () => {
      const platform = interceptor.determinePlatform('drive-mobile');
      expect(platform).toBe(WorkspaceLogPlatform.MOBILE);
    });

    it('When client is drive-desktop, then it should return DESKTOP platform', () => {
      const platform = interceptor.determinePlatform('drive-desktop');
      expect(platform).toBe(WorkspaceLogPlatform.DESKTOP);
    });

    it('When client is unknown, then it should return UNSPECIFIED platform', () => {
      const platform = interceptor.determinePlatform('unknown-client');
      expect(platform).toBe(WorkspaceLogPlatform.UNSPECIFIED);
    });
  });

  describe('intercept()', () => {
    it('When log action is valid, then it should call handleAction', async () => {
      const mockHandler = jest.fn();
      Reflect.defineMetadata(
        'workspaceLogAction',
        WorkspaceLogType.LOGIN,
        mockHandler,
      );

      const context: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'internxt-client': 'drive-web' },
          }),
        }),
        getHandler: () => mockHandler,
      } as any;

      const next: CallHandler = {
        handle: jest.fn().mockReturnValue(of({})),
      };

      const handleActionSpy = jest
        .spyOn(interceptor, 'handleAction')
        .mockResolvedValue(undefined);

      await interceptor.intercept(context, next).toPromise();

      expect(handleActionSpy).toHaveBeenCalled();
    });

    it('When log action is invalid, then it should log a debug message', async () => {
      const mockHandler = jest.fn();
      Reflect.defineMetadata(
        'workspaceLogAction',
        'INVALID_ACTION',
        mockHandler,
      );

      const context: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'internxt-client': 'drive-web' },
          }),
        }),
        getHandler: () => mockHandler,
      } as any;

      const next: CallHandler = {
        handle: jest.fn().mockReturnValue(of({})),
      };

      const loggerDebugSpy = jest.spyOn(Logger, 'debug');

      interceptor.intercept(context, next);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        '[WORKSPACE/LOGS] Invalid log action: INVALID_ACTION',
      );
    });
  });

  describe('handleAction()', () => {
    const req = {};
    const res = {};

    it('When action is recognized, then it should call the corresponding method', async () => {
      const platform = WorkspaceLogPlatform.WEB;

      const handleUserActionSpy = jest
        .spyOn(interceptor, 'handleUserAction')
        .mockImplementation();

      await interceptor.handleAction(
        platform,
        WorkspaceLogType.LOGIN,
        req,
        res,
      );

      expect(handleUserActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.LOGIN,
        req,
        res,
      );
    });

    it('When action is not recognized, then it should log a debug message', async () => {
      const platform = WorkspaceLogPlatform.WEB;

      await interceptor.handleAction(
        platform,
        'INVALID_ACTION' as WorkspaceLogType,
        req,
        res,
      );

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        '[WORKSPACE/LOGS] Action not recognized: INVALID_ACTION',
      );
    });
  });

  describe('registerWorkspaceLog()', () => {
    const payload = {
      workspaceId: 'workspace-id',
      creator: 'user-id',
      type: WorkspaceLogType.LOGIN,
      platform: WorkspaceLogPlatform.WEB,
      entityId: 'entity-id',
    };

    it('When registerLog is called, then it should call the repository method', async () => {
      await interceptor.registerWorkspaceLog(payload);

      expect(workspaceRepository.registerLog).toHaveBeenCalledWith({
        ...payload,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('When an error occurs, then it should log the error', async () => {
      jest
        .spyOn(workspaceRepository, 'registerLog')
        .mockRejectedValue(new Error('Database error'));

      await interceptor.registerWorkspaceLog(payload);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'An error occurred trying to register a log of type LOGIN for the user user-id',
        ),
        expect.any(Error),
      );
    });
  });

  describe('handleUserAction()', () => {
    it('When user is valid, then it should register logs for all workspaces', async () => {
      const req = {};
      const res = { user: { uuid: 'user-id' } };
      const workspaceIds = ['workspace-id-1', 'workspace-id-2'];

      jest
        .spyOn(interceptor, 'getUserWorkspaces')
        .mockResolvedValue(workspaceIds);
      const registerLogSpy = jest
        .spyOn(interceptor, 'registerWorkspaceLog')
        .mockImplementation();

      await interceptor.handleUserAction(
        WorkspaceLogPlatform.WEB,
        WorkspaceLogType.LOGIN,
        req,
        res,
      );

      expect(registerLogSpy).toHaveBeenCalledTimes(workspaceIds.length);
      workspaceIds.forEach((workspaceId) => {
        expect(registerLogSpy).toHaveBeenCalledWith({
          workspaceId,
          creator: 'user-id',
          type: WorkspaceLogType.LOGIN,
          platform: WorkspaceLogPlatform.WEB,
        });
      });
    });

    it('When user is invalid, then it should log a debug message', async () => {
      const req = {};
      const res = {};

      await interceptor.handleUserAction(
        WorkspaceLogPlatform.WEB,
        WorkspaceLogType.LOGIN,
        req,
        res,
      );

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        '[WORKSPACE/LOGS] User is required',
      );
    });
  });

  describe('handleUserWorkspaceAction()', () => {
    it('When request data is valid, then it should register a workspace log', async () => {
      const req = {
        body: { itemId: 'item-id' },
        params: {},
        workspace: { id: 'workspace-id' },
      };
      const res = { user: { uuid: 'user-id' } };
      const platform = WorkspaceLogPlatform.WEB;

      jest.spyOn(interceptor, 'extractRequestData').mockReturnValue({
        ok: true,
        requesterUuid: 'user-id',
        workspaceId: 'workspace-id',
      });
      const registerLogSpy = jest
        .spyOn(interceptor, 'registerWorkspaceLog')
        .mockImplementation();

      await interceptor.handleUserWorkspaceAction(
        platform,
        WorkspaceLogType.SHARE_FILE,
        req,
        res,
      );

      expect(registerLogSpy).toHaveBeenCalledWith({
        workspaceId: 'workspace-id',
        creator: 'user-id',
        type: WorkspaceLogType.SHARE_FILE,
        platform,
        entityId: 'item-id',
      });
    });

    it('When request data is invalid, then it should log a debug message', async () => {
      const req = { body: {}, params: {}, workspace: {} };
      const res = { user: { uuid: 'user-id' } };
      const platform = WorkspaceLogPlatform.WEB;

      await interceptor.handleUserWorkspaceAction(
        platform,
        WorkspaceLogType.SHARE_FILE,
        req,
        res,
      );

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        '[WORKSPACE/LOGS] Item Id is required',
      );
    });
  });

  describe('getItemType()', () => {
    it('When itemType is in body, then it should return itemType', () => {
      const req = { body: { itemType: 'FILE' } };
      const result = interceptor.getItemType(req);
      expect(result).toBe('FILE');
    });

    it('When itemType is in params, then it should return itemType', () => {
      const req = { params: { itemType: 'FOLDER' } };
      const result = interceptor.getItemType(req);
      expect(result).toBe('FOLDER');
    });

    it('When itemType is not present, then it should return undefined', () => {
      const req = { body: {}, params: {} };
      const result = interceptor.getItemType(req);
      expect(result).toBeUndefined();
    });
  });

  describe('getEntity()', () => {
    it('When itemId is in body, then it should return itemId', () => {
      const req = { body: { itemId: 'item-id' }, params: {} };
      const result = interceptor.getEntity(req, {});
      expect(result).toBe('item-id');
    });

    it('When itemId is in params, then it should return itemId', () => {
      const req = { body: {}, params: { itemId: 'item-id' } };
      const result = interceptor.getEntity(req, {});
      expect(result).toBe('item-id');
    });

    it('When itemId is in res, then it should return itemId', () => {
      const req = { body: {}, params: {} };
      const res = { itemId: 'item-id' };
      const result = interceptor.getEntity(req, res);
      expect(result).toBe('item-id');
    });

    it('When itemId is not present, then it should return undefined', () => {
      const req = { body: {}, params: {} };
      const result = interceptor.getEntity(req, {});
      expect(result).toBeUndefined();
    });
  });

  describe('determineAction()', () => {
    it('When type is SHARE and itemType is File, then it should return SHARE_FILE', () => {
      const action = interceptor.determineAction(
        'SHARE',
        WorkspaceItemType.File,
      );
      expect(action).toBe(WorkspaceLogType.SHARE_FILE);
    });

    it('When type is SHARE and itemType is Folder, then it should return SHARE_FOLDER', () => {
      const action = interceptor.determineAction(
        'SHARE',
        WorkspaceItemType.Folder,
      );
      expect(action).toBe(WorkspaceLogType.SHARE_FOLDER);
    });

    it('When type is DELETE and itemType is File, then it should return DELETE_FILE', () => {
      const action = interceptor.determineAction(
        'DELETE',
        WorkspaceItemType.File,
      );
      expect(action).toBe(WorkspaceLogType.DELETE_FILE);
    });

    it('When type is DELETE and itemType is Folder, then it should return DELETE_FOLDER', () => {
      const action = interceptor.determineAction(
        'DELETE',
        WorkspaceItemType.Folder,
      );
      expect(action).toBe(WorkspaceLogType.DELETE_FOLDER);
    });

    it('When type is invalid, then it should log a debug message', () => {
      const action = interceptor.determineAction(
        'INVALID_TYPE' as any,
        WorkspaceItemType.File,
      );
      expect(action).toBeNull();
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        '[WORKSPACE/LOGS] Invalid action type: INVALID_TYPE or item type: file',
      );
    });

    it('When itemType is invalid, then it should log a debug message', () => {
      const action = interceptor.determineAction(
        'SHARE',
        'INVALID_ITEM_TYPE' as any,
      );
      expect(action).toBeNull();
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        '[WORKSPACE/LOGS] Invalid action type: SHARE or item type: INVALID_ITEM_TYPE',
      );
    });
  });

  describe('extractRequestData()', () => {
    it('When requester and workspace are present, then it should return valid data', () => {
      const req = {
        params: { workspaceId: 'workspace-id' },
        requester: { uuid: 'requester-uuid' },
        workspace: {},
        user: { uuid: 'user-uuid' },
      };
      const result = interceptor.extractRequestData(req);
      expect(result).toEqual({
        ok: true,
        requesterUuid: 'requester-uuid',
        workspaceId: 'workspace-id',
      });
    });

    it('When requester is missing, then it should return invalid data', () => {
      const req = {
        params: { workspaceId: 'workspace-id' },
        requester: {},
        workspace: {},
        user: {},
      };
      const result = interceptor.extractRequestData(req);
      expect(result).toEqual({
        ok: false,
        requesterUuid: undefined,
        workspaceId: 'workspace-id',
      });
    });

    it('When workspaceId is missing, then it should return invalid data', () => {
      const req = {
        params: {},
        requester: { uuid: 'requester-uuid' },
        workspace: {},
        user: { uuid: 'user-uuid' },
      };
      const result = interceptor.extractRequestData(req);
      expect(result).toEqual({
        ok: false,
        requesterUuid: 'requester-uuid',
        workspaceId: undefined,
      });
    });
  });

  describe('getUserWorkspaces()', () => {
    it('When user has workspaces, then it should return their IDs', async () => {
      const uuid = 'user-id';

      const workspaces = [
        {
          workspace: { id: 'workspace-id-1', isWorkspaceReady: () => true },
          workspaceUser: { deactivated: false },
        },
        {
          workspace: { id: 'workspace-id-2', isWorkspaceReady: () => true },
          workspaceUser: { deactivated: false },
        },
      ] as any;
      jest
        .spyOn(workspaceRepository, 'findUserAvailableWorkspaces')
        .mockResolvedValue(workspaces);

      const result = await interceptor.getUserWorkspaces(uuid);
      expect(result).toEqual(['workspace-id-1', 'workspace-id-2']);
    });

    it('When user has no available workspaces, then it should return an empty array', async () => {
      const uuid = 'user-id';
      const workspaces = [
        {
          workspace: { id: 'workspace-id-1', isWorkspaceReady: () => false },
          workspaceUser: { deactivated: false },
        },
        {
          workspace: { id: 'workspace-id-2', isWorkspaceReady: () => true },
          workspaceUser: { deactivated: true },
        },
      ] as any;
      jest
        .spyOn(workspaceRepository, 'findUserAvailableWorkspaces')
        .mockResolvedValue(workspaces);

      const result = await interceptor.getUserWorkspaces(uuid);
      expect(result).toEqual([]);
    });
  });

  describe('logIn()', () => {
    it('When called, then it should call handleUser Action with LOGIN type', async () => {
      const platform = WorkspaceLogPlatform.WEB;
      const req = {};
      const res = {};

      const handleUserActionSpy = jest
        .spyOn(interceptor, 'handleUserAction')
        .mockImplementation();

      await interceptor.logIn(platform, req, res);

      expect(handleUserActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.LOGIN,
        req,
        res,
      );
    });
  });

  describe('changedPassword()', () => {
    it('When called, then it should call handleUser Action with CHANGED_PASSWORD type', async () => {
      const platform = WorkspaceLogPlatform.WEB;
      const req = {};
      const res = {};

      const handleUserActionSpy = jest
        .spyOn(interceptor, 'handleUserAction')
        .mockImplementation();

      await interceptor.changedPassword(platform, req, res);

      expect(handleUserActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.CHANGED_PASSWORD,
        req,
        res,
      );
    });
  });

  describe('logout()', () => {
    it('When called, then it should call handleUser Action with LOGOUT type', async () => {
      const platform = WorkspaceLogPlatform.WEB;
      const req = {};
      const res = {};

      const handleUserActionSpy = jest
        .spyOn(interceptor, 'handleUserAction')
        .mockImplementation();

      await interceptor.logout(platform, req, res);

      expect(handleUserActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.LOGOUT,
        req,
        res,
      );
    });
  });

  describe('share()', () => {
    it('When itemType is valid, then it should call handleUserWorkspaceAction', async () => {
      const platform = WorkspaceLogPlatform.WEB;
      const req = { body: { itemType: 'file' } };
      const res = {};

      const determineActionSpy = jest
        .spyOn(interceptor, 'determineAction')
        .mockReturnValue(WorkspaceLogType.SHARE_FILE);
      const handleUserWorkspaceActionSpy = jest
        .spyOn(interceptor, 'handleUserWorkspaceAction')
        .mockImplementation();

      await interceptor.share(platform, req, res);

      expect(determineActionSpy).toHaveBeenCalledWith('SHARE', 'file');
      expect(handleUserWorkspaceActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.SHARE_FILE,
        req,
        res,
      );
    });

    it('When itemType is not provided, then it should log a debug message', async () => {
      const platform = WorkspaceLogPlatform.WEB;
      const req = { body: {} };
      const res = {};

      await interceptor.share(platform, req, res);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        '[WORKSPACE/LOGS] The item type is required',
      );
    });
  });

  describe('shareFile()', () => {
    it('When called, then it should call handleUser WorkspaceAction with SHARE_FILE type', async () => {
      const platform = WorkspaceLogPlatform.WEB;
      const req = {};
      const res = {};

      const handleUserWorkspaceActionSpy = jest
        .spyOn(interceptor, 'handleUserWorkspaceAction')
        .mockImplementation();

      await interceptor.shareFile(platform, req, res);

      expect(handleUserWorkspaceActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.SHARE_FILE,
        req,
        res,
      );
    });
  });

  describe('shareFolder()', () => {
    it('When called, then it should call handleUser WorkspaceAction with SHARE_FOLDER type', async () => {
      const platform = WorkspaceLogPlatform.WEB;
      const req = {};
      const res = {};

      const handleUserWorkspaceActionSpy = jest
        .spyOn(interceptor, 'handleUserWorkspaceAction')
        .mockImplementation();

      await interceptor.shareFolder(platform, req, res);

      expect(handleUserWorkspaceActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.SHARE_FOLDER,
        req,
        res,
      );
    });
  });

  describe('delete()', () => {
    it('When items are provided, then it should register logs for each item', async () => {
      const platform = WorkspaceLogPlatform.WEB;
      const req = { body: { items: [{ type: 'file', uuid: 'file-id' }] } };
      const res = {};
      const registerLogSpy = jest
        .spyOn(interceptor, 'registerWorkspaceLog')
        .mockResolvedValue(undefined);
      const extractRequestDataSpy = jest
        .spyOn(interceptor, 'extractRequestData')
        .mockReturnValue({
          ok: true,
          requesterUuid: 'requester-uuid',
          workspaceId: 'workspace-id',
        });
      jest
        .spyOn(interceptor, 'determineAction')
        .mockReturnValue(WorkspaceLogType.DELETE_FILE);

      await interceptor.delete(platform, req, res);

      expect(extractRequestDataSpy).toHaveBeenCalledWith(req);
      expect(registerLogSpy).toHaveBeenCalledWith({
        workspaceId: 'workspace-id',
        creator: 'requester-uuid',
        type: WorkspaceLogType.DELETE_FILE,
        platform,
        entityId: 'file-id',
      });
    });

    it('When no items are provided, then it should log a debug message', async () => {
      const platform = WorkspaceLogPlatform.WEB;
      const req = { body: {} };
      const res = {};

      await interceptor.delete(platform, req, res);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        '[WORKSPACE/LOGS] The items are required',
      );
    });
  });

  describe('deleteFile()', () => {
    it('When called, then it should call handleUser  WorkspaceAction with DELETE_FILE type', async () => {
      const platform = WorkspaceLogPlatform.WEB;
      const req = {};
      const res = {};

      const handleUserWorkspaceActionSpy = jest
        .spyOn(interceptor, 'handleUserWorkspaceAction')
        .mockImplementation();

      await interceptor.deleteFile(platform, req, res);

      expect(handleUserWorkspaceActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.DELETE_FILE,
        req,
        res,
      );
    });
  });

  describe('deleteFolder()', () => {
    it('When called, then it should call handleUser  WorkspaceAction with DELETE_FOLDER type', async () => {
      const platform = WorkspaceLogPlatform.WEB;
      const req = {};
      const res = {};

      const handleUserWorkspaceActionSpy = jest
        .spyOn(interceptor, 'handleUserWorkspaceAction')
        .mockImplementation();

      await interceptor.deleteFolder(platform, req, res);

      expect(handleUserWorkspaceActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.DELETE_FOLDER,
        req,
        res,
      );
    });
  });
});
