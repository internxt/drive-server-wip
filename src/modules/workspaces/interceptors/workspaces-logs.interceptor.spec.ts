import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { WorkspacesLogsInterceptor } from './workspaces-logs.interceptor';
import { type SequelizeWorkspaceRepository } from '../repositories/workspaces.repository';
import {
  WorkspaceLogType,
  WorkspaceLogPlatform,
  WorkspaceLogGlobalActionType,
} from '../attributes/workspace-logs.attributes';
import {
  type CallHandler,
  type ExecutionContext,
  Logger,
} from '@nestjs/common';
import { isObservable, lastValueFrom, of } from 'rxjs';
import { WorkspaceItemType } from '../attributes/workspace-items-users.attributes';
import { ClientEnum } from '../../../common/enums/platform.enum';

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
      const platform = interceptor.determinePlatform(ClientEnum.Web);
      expect(platform).toBe(WorkspaceLogPlatform.Web);
    });

    it('When client is drive-mobile, then it should return MOBILE platform', () => {
      const platform = interceptor.determinePlatform(ClientEnum.Mobile);
      expect(platform).toBe(WorkspaceLogPlatform.Mobile);
    });

    it('When client is drive-desktop, then it should return DESKTOP platform', () => {
      const platform = interceptor.determinePlatform(ClientEnum.Desktop);
      expect(platform).toBe(WorkspaceLogPlatform.Desktop);
    });
  });

  describe('intercept()', () => {
    const mockHandler = jest.fn();
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'internxt-client': ClientEnum.Web },
        }),
      }),
      getHandler: () => mockHandler,
    } as any;

    it('When log action is valid, then it should call handleAction', async () => {
      Reflect.defineMetadata(
        'workspaceLogAction',
        WorkspaceLogType.Login,
        mockHandler,
      );

      const next: CallHandler = {
        handle: jest.fn().mockReturnValue(of({})),
      };

      const handleActionSpy = jest
        .spyOn(interceptor, 'handleAction')
        .mockResolvedValue(undefined);

      await lastValueFrom(interceptor.intercept(context, next));

      expect(handleActionSpy).toHaveBeenCalled();
      expect(next.handle).toHaveBeenCalled();
    });

    it('When log action is invalid, then it should log an invalid action message', async () => {
      Reflect.defineMetadata(
        'workspaceLogAction',
        'INVALID_ACTION',
        mockHandler,
      );

      const next: CallHandler = {
        handle: jest.fn().mockReturnValue(of({})),
      };

      const loggerDebugSpy = jest.spyOn(Logger, 'debug');

      interceptor.intercept(context, next);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        '[WORKSPACE/LOGS] Invalid log action: INVALID_ACTION',
      );
      expect(next.handle).toHaveBeenCalled();
    });

    it('When log action is invalid, then it should return a stream to continue with the request', async () => {
      Reflect.defineMetadata(
        'workspaceLogAction',
        'INVALID_ACTION',
        mockHandler,
      );

      const next: CallHandler = {
        handle: jest.fn().mockReturnValue(of({})),
      };

      const result = interceptor.intercept(context, next);

      expect(isObservable(result)).toBe(true);
    });

    it('When platform is not identified, then it should return a stream to continue with the request', async () => {
      Reflect.defineMetadata(
        'workspaceLogAction',
        WorkspaceLogType.Login,
        mockHandler,
      );

      const contextWithoutPlaformHeader: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
          }),
        }),
        getHandler: () => mockHandler,
      } as any;

      const next: CallHandler = {
        handle: jest.fn().mockReturnValue(of({})),
      };

      const result = interceptor.intercept(contextWithoutPlaformHeader, next);

      expect(isObservable(result)).toBe(true);
    });

    it('When handleAction fails then should log an error', async () => {
      Reflect.defineMetadata(
        'workspaceLogAction',
        WorkspaceLogType.Login,
        mockHandler,
      );

      const next: CallHandler = {
        handle: jest.fn().mockReturnValue(of({})),
      };

      const handleActionSpy = jest
        .spyOn(interceptor, 'handleAction')
        .mockRejectedValueOnce(new Error('Logging failed'));

      const logErrorSpy = jest.spyOn(Logger, 'error').mockImplementation();

      await lastValueFrom(interceptor.intercept(context, next));

      expect(handleActionSpy).toHaveBeenCalled();
      expect(logErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error logging action: Logging failed'),
      );
      expect(logErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Platform: ${WorkspaceLogPlatform.Web}`),
      );
      expect(logErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Action: ${WorkspaceLogType.Login}`),
      );
      expect(next.handle).toHaveBeenCalled();
    });
  });

  describe('handleAction()', () => {
    const req = {};
    const res = {};

    it('When action is recognized, then it should call the corresponding method', async () => {
      const platform = WorkspaceLogPlatform.Web;

      const handleUserActionSpy = jest
        .spyOn(interceptor, 'handleUserAction')
        .mockImplementation();

      await interceptor.handleAction(
        platform,
        WorkspaceLogType.Login,
        req,
        res,
      );

      expect(handleUserActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.Login,
        req,
        res,
      );
    });

    it('When action is not recognized, then it should log a debug message', async () => {
      const platform = WorkspaceLogPlatform.Web;

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

  describe('logWorkspaceAction()', () => {
    const payload = {
      workspaceId: 'workspace-id',
      creator: 'user-id',
      type: WorkspaceLogType.Login,
      platform: WorkspaceLogPlatform.Web,
      entityId: 'entity-id',
    };

    it('When registerLog is called, then it should call the repository method', async () => {
      await interceptor.logWorkspaceAction(payload);

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

      await interceptor.logWorkspaceAction(payload);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `An error occurred trying to register a log of type ${payload.type} for the user user-id`,
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
        .spyOn(interceptor, 'fetchUserWorkspacesIds')
        .mockResolvedValue(workspaceIds);
      const registerLogSpy = jest
        .spyOn(interceptor, 'logWorkspaceAction')
        .mockImplementation();

      await interceptor.handleUserAction(
        WorkspaceLogPlatform.Web,
        WorkspaceLogType.Login,
        req,
        res,
      );

      expect(registerLogSpy).toHaveBeenCalledTimes(workspaceIds.length);
      workspaceIds.forEach((workspaceId) => {
        expect(registerLogSpy).toHaveBeenCalledWith({
          workspaceId,
          creator: 'user-id',
          type: WorkspaceLogType.Login,
          platform: WorkspaceLogPlatform.Web,
        });
      });
    });

    it('When user is invalid, then it should log a debug message', async () => {
      const req = {};
      const res = {};

      await interceptor.handleUserAction(
        WorkspaceLogPlatform.Web,
        WorkspaceLogType.Login,
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
      const platform = WorkspaceLogPlatform.Web;

      jest.spyOn(interceptor, 'extractRequestData').mockReturnValue({
        ok: true,
        requesterUuid: 'user-id',
        workspaceId: 'workspace-id',
      });
      const registerLogSpy = jest
        .spyOn(interceptor, 'logWorkspaceAction')
        .mockImplementation();

      await interceptor.handleUserWorkspaceAction(
        platform,
        WorkspaceLogType.ShareFile,
        req,
        res,
      );

      expect(registerLogSpy).toHaveBeenCalledWith({
        workspaceId: 'workspace-id',
        creator: 'user-id',
        type: WorkspaceLogType.ShareFile,
        platform,
        entityId: 'item-id',
      });
    });

    it('When request data is invalid, then it should log a debug message', async () => {
      const req = { body: {}, params: {}, workspace: {} };
      const res = { user: { uuid: 'user-id' } };
      const platform = WorkspaceLogPlatform.Web;

      await interceptor.handleUserWorkspaceAction(
        platform,
        WorkspaceLogType.ShareFile,
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
      const req = { body: { itemType: 'file' } };
      const result = interceptor.getItemType(req);
      expect(result).toBe('file');
    });

    it('When itemType is in params, then it should return itemType', () => {
      const req = { params: { itemType: 'folder' } };
      const result = interceptor.getItemType(req);
      expect(result).toBe('folder');
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

  describe('getActionForGlobalLogType()', () => {
    it('When type is Share and itemType is File, then it should return ShareFile', () => {
      const action = interceptor.getActionForGlobalLogType(
        WorkspaceLogGlobalActionType.Share,
        WorkspaceItemType.File,
      );
      expect(action).toBe(WorkspaceLogType.ShareFile);
    });

    it('When type is Share and itemType is Folder, then it should return ShareFolder', () => {
      const action = interceptor.getActionForGlobalLogType(
        WorkspaceLogGlobalActionType.Share,
        WorkspaceItemType.Folder,
      );
      expect(action).toBe(WorkspaceLogType.ShareFolder);
    });

    it('When type is Delete and itemType is File, then it should return DeleteFile', () => {
      const action = interceptor.getActionForGlobalLogType(
        WorkspaceLogGlobalActionType.Delete,
        WorkspaceItemType.File,
      );
      expect(action).toBe(WorkspaceLogType.DeleteFile);
    });

    it('When type is Delete and itemType is Folder, then it should return DeleteFolder', () => {
      const action = interceptor.getActionForGlobalLogType(
        WorkspaceLogGlobalActionType.Delete,
        WorkspaceItemType.Folder,
      );
      expect(action).toBe(WorkspaceLogType.DeleteFolder);
    });

    it('When type is invalid, then it should log a debug message', () => {
      const action = interceptor.getActionForGlobalLogType(
        'INVALID_TYPE' as any,
        WorkspaceItemType.File,
      );
      expect(action).toBeNull();
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        '[WORKSPACE/LOGS] Invalid action type: INVALID_TYPE or item type: file',
      );
    });

    it('When itemType is invalid, then it should log a debug message', () => {
      const action = interceptor.getActionForGlobalLogType(
        WorkspaceLogGlobalActionType.Share,
        'INVALID_ITEM_TYPE' as any,
      );
      expect(action).toBeNull();
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        `[WORKSPACE/LOGS] Invalid action type: ${WorkspaceLogGlobalActionType.Share} or item type: INVALID_ITEM_TYPE`,
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

  describe('fetchUserWorkspacesIds()', () => {
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

      const result = await interceptor.fetchUserWorkspacesIds(uuid);
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

      const result = await interceptor.fetchUserWorkspacesIds(uuid);
      expect(result).toEqual([]);
    });
  });

  describe('logIn()', () => {
    it('When called, then it should call handleUser Action with logIn type', async () => {
      const platform = WorkspaceLogPlatform.Web;
      const req = {};
      const res = {};

      const handleUserActionSpy = jest
        .spyOn(interceptor, 'handleUserAction')
        .mockImplementation();

      await interceptor.logIn(platform, req, res);

      expect(handleUserActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.Login,
        req,
        res,
      );
    });
  });

  describe('changedPassword()', () => {
    it('When called, then it should call handleUser Action with ChangedPassword type', async () => {
      const platform = WorkspaceLogPlatform.Web;
      const req = {};
      const res = {};

      const handleUserActionSpy = jest
        .spyOn(interceptor, 'handleUserAction')
        .mockImplementation();

      await interceptor.changedPassword(platform, req, res);

      expect(handleUserActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.ChangedPassword,
        req,
        res,
      );
    });
  });

  describe('logout()', () => {
    it('When called, then it should call handleUser Action with Logout type', async () => {
      const platform = WorkspaceLogPlatform.Web;
      const req = {};
      const res = {};

      const handleUserActionSpy = jest
        .spyOn(interceptor, 'handleUserAction')
        .mockImplementation();

      await interceptor.logout(platform, req, res);

      expect(handleUserActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.Logout,
        req,
        res,
      );
    });
  });

  describe('share()', () => {
    it('When itemType is valid, then it should call handleUserWorkspaceAction', async () => {
      const platform = WorkspaceLogPlatform.Web;
      const req = { body: { itemType: 'file' } };
      const res = {};

      const getActionForGlobalLogType = jest
        .spyOn(interceptor, 'getActionForGlobalLogType')
        .mockReturnValue(WorkspaceLogType.ShareFile);
      const handleUserWorkspaceActionSpy = jest
        .spyOn(interceptor, 'handleUserWorkspaceAction')
        .mockImplementation();

      await interceptor.share(platform, req, res);

      expect(getActionForGlobalLogType).toHaveBeenCalledWith(
        WorkspaceLogGlobalActionType.Share,
        'file',
      );
      expect(handleUserWorkspaceActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.ShareFile,
        req,
        res,
      );
    });

    it('When itemType is not provided, then it should log a debug message', async () => {
      const platform = WorkspaceLogPlatform.Web;
      const req = { body: {} };
      const res = {};

      await interceptor.share(platform, req, res);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        '[WORKSPACE/LOGS] The item type is required',
      );
    });
  });

  describe('shareFile()', () => {
    it('When called, then it should call handleUser WorkspaceAction with ShareFile type', async () => {
      const platform = WorkspaceLogPlatform.Web;
      const req = {};
      const res = {};

      const handleUserWorkspaceActionSpy = jest
        .spyOn(interceptor, 'handleUserWorkspaceAction')
        .mockImplementation();

      await interceptor.shareFile(platform, req, res);

      expect(handleUserWorkspaceActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.ShareFile,
        req,
        res,
      );
    });
  });

  describe('shareFolder()', () => {
    it('When called, then it should call handleUser WorkspaceAction with ShareFolder type', async () => {
      const platform = WorkspaceLogPlatform.Web;
      const req = {};
      const res = {};

      const handleUserWorkspaceActionSpy = jest
        .spyOn(interceptor, 'handleUserWorkspaceAction')
        .mockImplementation();

      await interceptor.shareFolder(platform, req, res);

      expect(handleUserWorkspaceActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.ShareFolder,
        req,
        res,
      );
    });
  });

  describe('delete()', () => {
    it('When items are provided, then it should register logs for each item', async () => {
      const platform = WorkspaceLogPlatform.Web;
      const req = { body: { items: [{ type: 'file', uuid: 'file-id' }] } };
      const res = {};
      const registerLogSpy = jest
        .spyOn(interceptor, 'logWorkspaceAction')
        .mockResolvedValue(undefined);
      const extractRequestDataSpy = jest
        .spyOn(interceptor, 'extractRequestData')
        .mockReturnValue({
          ok: true,
          requesterUuid: 'requester-uuid',
          workspaceId: 'workspace-id',
        });
      jest
        .spyOn(interceptor, 'getActionForGlobalLogType')
        .mockReturnValue(WorkspaceLogType.DeleteFile);

      await interceptor.delete(platform, req, res);

      expect(extractRequestDataSpy).toHaveBeenCalledWith(req);
      expect(registerLogSpy).toHaveBeenCalledWith({
        workspaceId: 'workspace-id',
        creator: 'requester-uuid',
        type: WorkspaceLogType.DeleteFile,
        platform,
        entityId: 'file-id',
      });
    });

    it('When no items are provided, then it should log a debug message', async () => {
      const platform = WorkspaceLogPlatform.Web;
      const req = { body: {} };
      const res = {};

      await interceptor.delete(platform, req, res);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        '[WORKSPACE/LOGS] The items are required',
      );
    });
  });

  describe('deleteFile()', () => {
    it('When called, then it should call handleUser  WorkspaceAction with DeleteFile type', async () => {
      const platform = WorkspaceLogPlatform.Web;
      const req = {};
      const res = {};

      const handleUserWorkspaceActionSpy = jest
        .spyOn(interceptor, 'handleUserWorkspaceAction')
        .mockImplementation();

      await interceptor.deleteFile(platform, req, res);

      expect(handleUserWorkspaceActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.DeleteFile,
        req,
        res,
      );
    });
  });

  describe('deleteFolder()', () => {
    it('When called, then it should call handleUser  WorkspaceAction with DeleteFolder type', async () => {
      const platform = WorkspaceLogPlatform.Web;
      const req = {};
      const res = {};

      const handleUserWorkspaceActionSpy = jest
        .spyOn(interceptor, 'handleUserWorkspaceAction')
        .mockImplementation();

      await interceptor.deleteFolder(platform, req, res);

      expect(handleUserWorkspaceActionSpy).toHaveBeenCalledWith(
        platform,
        WorkspaceLogType.DeleteFolder,
        req,
        res,
      );
    });
  });
});
