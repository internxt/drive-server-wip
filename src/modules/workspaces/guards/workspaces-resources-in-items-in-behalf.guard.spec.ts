import { DeepMocked, createMock } from '@golevelup/ts-jest';
import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspacesUsecases } from '../workspaces.usecase';
import { verifyWithDefaultSecret } from '../../../lib/jwt';
import { WorkspaceResourcesAction } from './workspaces-resources-in-behalf.decorator';
import { WorkspacesResourcesItemsInBehalfGuard } from './workspaces-resources-in-items-in-behalf.guard';
import {
  newUser,
  newWorkspace,
  newWorkspaceItemUser,
  newWorkspaceUser,
} from '../../../../test/fixtures';
import { v4 } from 'uuid';
import { WorkspaceItemType } from '../attributes/workspace-items-users.attributes';
import { extractDataFromRequest } from '../../../common/extract-data-from-request';

jest.mock('../../../lib/jwt', () => ({
  verifyWithDefaultSecret: jest.fn(),
}));

jest.mock('../../../common/extract-data-from-request', () => ({
  extractDataFromRequest: jest.fn(),
}));

describe('WorkspacesResourcesItemsInBehalfGuard', () => {
  let guard: WorkspacesResourcesItemsInBehalfGuard;
  let reflector: DeepMocked<Reflector>;
  let workspaceUseCases: DeepMocked<WorkspacesUsecases>;

  beforeEach(async () => {
    reflector = createMock<Reflector>();
    workspaceUseCases = createMock<WorkspacesUsecases>();
    guard = new WorkspacesResourcesItemsInBehalfGuard(
      reflector,
      workspaceUseCases,
    );
  });

  it('Guard should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('When there is no user set, then block access', async () => {
      const context = createMockExecutionContext(null, {});

      const canUserAccess = await guard.canActivate(context);

      expect(canUserAccess).toBeFalsy();
    });

    it('When there is no token, then do not take action', async () => {
      const user = newUser();
      const context = createMockExecutionContext(user, { headers: {} });

      const canUserAccess = await guard.canActivate(context);

      expect(canUserAccess).toBeTruthy();
    });

    it('When workspace token is invalid, then throw', async () => {
      const user = newUser();
      const context = createMockExecutionContext(user, {
        headers: { 'x-internxt-workspace': 'invalid-token' },
      });

      (verifyWithDefaultSecret as jest.Mock).mockImplementation(() => {
        throw new Error();
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('When workspace user is deactivated, then do not give access', async () => {
      const user = newUser();
      const workspace = newWorkspace();

      const member = newWorkspaceUser({
        workspaceId: workspace.id,
        attributes: { deactivated: true },
      });
      const context = createMockExecutionContext(user, {
        headers: { 'x-internxt-workspace': 'valid-token' },
      });

      (verifyWithDefaultSecret as jest.Mock).mockReturnValue({
        workspaceId: workspace.id,
      });

      workspaceUseCases.findUserAndWorkspace.mockResolvedValue({
        workspace,
        workspaceUser: member,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('When user has no permissions, and action is not set then deny access', async () => {
      const user = newUser();
      const behalfUser = newUser();
      const workspace = newWorkspace({
        attributes: { workspaceUserId: behalfUser.uuid },
      });
      const member = newWorkspaceUser({
        workspaceId: workspace.id,
      });
      const workspaceItem = newWorkspaceItemUser({
        workspaceId: workspace.id,
        attributes: { createdBy: user.uuid },
      });
      const excutionContext = createMockExecutionContext(user, {
        headers: { 'x-internxt-workspace': 'valid-token' },
        params: { uuid: workspaceItem.itemId },
      });

      (verifyWithDefaultSecret as jest.Mock).mockReturnValue({
        workspaceId: workspace.id,
      });
      workspaceUseCases.findUserAndWorkspace.mockResolvedValue({
        workspace,
        workspaceUser: member,
      });
      workspaceUseCases.findWorkspaceResourceOwner.mockResolvedValue(
        behalfUser,
      );
      workspaceUseCases.isUserCreatorOfItem.mockResolvedValue(false);

      jest.spyOn(reflector, 'get').mockReturnValueOnce(undefined);

      (extractDataFromRequest as jest.Mock).mockReturnValue({
        itemId: workspaceItem.itemId,
      });

      await expect(guard.canActivate(excutionContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('When user has permission and action is not set, then give access and set request user', async () => {
      const user = newUser();
      const behalfUser = newUser();
      const workspace = newWorkspace({
        attributes: { workspaceUserId: behalfUser.uuid },
      });
      const member = newWorkspaceUser({
        workspaceId: workspace.id,
      });
      const excutionContext = createMockExecutionContext(user, {
        headers: { 'x-internxt-workspace': 'valid-token' },
        params: { uuid: v4() },
      });

      (verifyWithDefaultSecret as jest.Mock).mockReturnValue({
        workspaceId: workspace.id,
      });
      workspaceUseCases.findUserAndWorkspace.mockResolvedValue({
        workspace,
        workspaceUser: member,
      });
      workspaceUseCases.findWorkspaceResourceOwner.mockResolvedValue(
        behalfUser,
      );

      jest.spyOn(reflector, 'get').mockReturnValueOnce(undefined);

      (extractDataFromRequest as jest.Mock).mockReturnValue({
        itemId: v4(),
      });

      const spyOnDefaultHandler = jest
        .spyOn(guard['actionHandlers'], WorkspaceResourcesAction.Default)
        .mockResolvedValueOnce(true);

      const canUserAccess = await guard.canActivate(excutionContext);

      expect(canUserAccess).toBeTruthy();
      expect(spyOnDefaultHandler).toHaveBeenCalled();
      expect(excutionContext.switchToHttp().getRequest().user).toEqual(
        behalfUser,
      );
      expect(excutionContext.switchToHttp().getRequest().requester).toEqual(
        user,
      );
    });

    it('When user has permission and action is set, then give access and set request user', async () => {
      const user = newUser();
      const behalfUser = newUser();
      const workspace = newWorkspace({
        attributes: { workspaceUserId: behalfUser.uuid },
      });
      const member = newWorkspaceUser({
        workspaceId: workspace.id,
      });

      const excutionContext = createMockExecutionContext(user, {
        headers: { 'x-internxt-workspace': 'valid-token' },
        body: {
          items: [
            {
              uuid: '6c63b34c-0396-4018-820b-cae3457217e0',
              type: 'folder',
            },
            {
              uuid: '61f9f35f-285e-40f1-87b8-b5d55db34be5',
              type: 'file',
            },
          ],
        },
      });

      (verifyWithDefaultSecret as jest.Mock).mockReturnValue({
        workspaceId: workspace.id,
      });
      jest
        .spyOn(reflector, 'get')
        .mockReturnValueOnce(WorkspaceResourcesAction.AddItemsToTrash);

      workspaceUseCases.findUserAndWorkspace.mockResolvedValue({
        workspace,
        workspaceUser: member,
      });
      workspaceUseCases.findWorkspaceResourceOwner.mockResolvedValue(
        behalfUser,
      );

      (extractDataFromRequest as jest.Mock).mockReturnValue({
        items: [
          {
            itemId: '6c63b34c-0396-4018-820b-cae3457217e0',
            itemType: 'folder',
          },
          {
            itemId: '61f9f35f-285e-40f1-87b8-b5d55db34be5',
            itemType: 'file',
          },
        ],
      });

      const spyOnDefaultHandler = jest.spyOn(
        guard['actionHandlers'],
        WorkspaceResourcesAction.Default,
      );
      const spyOnNotDefaultHandler = jest
        .spyOn(
          guard['actionHandlers'],
          WorkspaceResourcesAction.AddItemsToTrash,
        )
        .mockResolvedValueOnce(true);

      const canUserAccess = await guard.canActivate(excutionContext);

      expect(canUserAccess).toBeTruthy();
      expect(spyOnDefaultHandler).not.toHaveBeenCalled();
      expect(spyOnNotDefaultHandler).toHaveBeenCalled();
      expect(excutionContext.switchToHttp().getRequest().user).toEqual(
        behalfUser,
      );
      expect(excutionContext.switchToHttp().getRequest().requester).toEqual(
        user,
      );
    });
  });

  describe('hasUserPermissions', () => {
    it('When item id is not valid, it should throw', async () => {
      const user = newUser();

      await expect(
        guard.hasUserPermissions(user, {
          itemId: 'no-uuid',
          itemType: WorkspaceItemType.File,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('When item is valid, it should return user permissions', async () => {
      const user = newUser();

      workspaceUseCases.isUserCreatorOfItem.mockResolvedValue(false);

      const hasPermissions = await guard.hasUserPermissions(user, {
        itemId: v4(),
        itemType: WorkspaceItemType.File,
      });

      expect(hasPermissions).toBeFalsy();
    });
  });

  describe('hasUserTrashPermissions', () => {
    it('When any item id is not valid, it should throw', async () => {
      const user = newUser();

      await expect(
        guard.hasUserTrashPermissions(user, {
          items: [{ uuid: 'no-uuid', type: WorkspaceItemType.File }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('When all items are valid, it should return user permissions', async () => {
      const user = newUser();

      workspaceUseCases.isUserCreatorOfItem.mockResolvedValue(true);

      const hasPermissions = await guard.hasUserTrashPermissions(user, {
        items: [
          { uuid: v4(), type: WorkspaceItemType.File },
          { uuid: v4(), type: WorkspaceItemType.Folder },
        ],
      });
      expect(hasPermissions).toBeTruthy();
    });
  });
});

const createMockExecutionContext = (
  user: any,
  requestPayload: any,
): ExecutionContext => {
  const request = {
    user: user,
    ...requestPayload,
  };

  return {
    getHandler: () => ({
      name: 'endPointHandler',
    }),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
};
