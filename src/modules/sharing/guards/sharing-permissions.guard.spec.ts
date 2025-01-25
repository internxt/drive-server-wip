import { DeepMocked, createMock } from '@golevelup/ts-jest';
import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserUseCases } from '../../user/user.usecase';
import { SharingService } from '../../sharing/sharing.service';
import { WorkspacesUsecases } from '../../workspaces/workspaces.usecase';
import { SharingPermissionsGuard } from './sharing-permissions.guard';

import { verifyWithDefaultSecret } from '../../../lib/jwt';
import {
  SharedWithType,
  SharingActionName,
} from '../../sharing/sharing.domain';
import {
  PermissionsMetadataName,
  PermissionsOptions,
} from './sharing-permissions.decorator';

import {
  newFolder,
  newUser,
  newWorkspace,
  newWorkspaceTeam,
} from '../../../../test/fixtures';
import { v4 } from 'uuid';
import { SharingAccessTokenData } from './sharings-token.interface';

jest.mock('../../../lib/jwt');

const user = newUser();

describe('SharingPermissionsGuard', () => {
  let guard: SharingPermissionsGuard;
  let reflector: DeepMocked<Reflector>;
  let userUseCases: DeepMocked<UserUseCases>;
  let sharingUseCases: DeepMocked<SharingService>;
  let workspaceUseCases: DeepMocked<WorkspacesUsecases>;

  beforeEach(async () => {
    reflector = createMock<Reflector>();
    userUseCases = createMock<UserUseCases>();
    sharingUseCases = createMock<SharingService>();
    workspaceUseCases = createMock<WorkspacesUsecases>();
    guard = new SharingPermissionsGuard(
      reflector,
      userUseCases,
      sharingUseCases,
      workspaceUseCases,
    );
  });

  it('Guard should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('When user is not part of the request, it should deny access', async () => {
    const context = createMockExecutionContext({});

    await expect(guard.canActivate(context)).resolves.toBe(false);
  });

  it('When resources token is invalid, it should throw', async () => {
    mockMetadata(reflector, { action: SharingActionName.UploadFile });

    const context = createMockExecutionContext({
      user,
      headers: { 'internxt-resources-token': 'invalid-token' },
    });
    (verifyWithDefaultSecret as jest.Mock).mockImplementation(
      () => 'invalid-decoded',
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('When shared item access is verified successfully, then it should proceed to check permissions', async () => {
    const context = createMockExecutionContext({
      user: { uuid: 'requester-uuid' },
      headers: { 'internxt-resources-token': 'valid-token' },
    });
    const owner = newUser({ attributes: { uuid: 'owner-uuid' } });

    const decoded = {
      sharedRootFolderId: 'shared-folder-id',
      workspace: { workspaceId: 'workspace-id' },
      owner: { uuid: owner.uuid },
    } as SharingAccessTokenData;

    jest.spyOn(reflector, 'get').mockReturnValue({ action: 'some-action' });
    (verifyWithDefaultSecret as jest.Mock).mockReturnValue(decoded);
    jest.spyOn(guard, 'verifySharedItemAccess').mockResolvedValue(undefined);
    jest
      .spyOn(guard, 'isWorkspaceMemberAbleToPerfomAction')
      .mockResolvedValue(true);
    jest.spyOn(userUseCases, 'findByUuid').mockResolvedValue(owner);

    const result = await guard.canActivate(context);
    const request = context.switchToHttp().getRequest();

    expect(result).toBe(true);
    expect(request.isSharedItem).toBe(true);
  });

  it('When shared item ID is not found, then it should throw ForbiddenException', async () => {
    const context = createMockExecutionContext({
      user: { uuid: 'requester-uuid' },
      headers: { 'internxt-resources-token': 'valid-token' },
    });

    const decoded = {
      sharedRootFolderId: undefined,
      owner: { uuid: 'owner-uuid' },
    } as SharingAccessTokenData;

    jest.spyOn(reflector, 'get').mockReturnValue({ action: 'some-action' });
    (verifyWithDefaultSecret as jest.Mock).mockReturnValue(decoded);

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('When workspace and team permissions are valid, it should allow allow', async () => {
    const workspace = newWorkspace();
    const team = newWorkspaceTeam();
    const folder = newFolder();
    mockMetadata(reflector, { action: SharingActionName.UploadFile });

    const context = createMockExecutionContext({
      user,
      headers: { 'internxt-resources-token': 'valid-token' },
    });

    (verifyWithDefaultSecret as jest.Mock).mockImplementation(() => ({
      workspace: { workspaceId: workspace.id, teamId: team.id },
      sharedRootFolderId: folder.uuid,
      sharedWithType: SharedWithType.WorkspaceTeam,
      owner: { uuid: user.uuid },
    }));

    jest
      .spyOn(guard, 'isWorkspaceMemberAbleToPerfomAction')
      .mockResolvedValue(true);
    jest.spyOn(userUseCases, 'findByUuid').mockResolvedValue(user);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('When user is not part of the team, it should throw', async () => {
    const workspace = newWorkspace();
    const team = newWorkspaceTeam();
    const folder = newFolder();
    mockMetadata(reflector, { action: SharingActionName.UploadFile });

    const context = createMockExecutionContext({
      user,
      headers: { 'internxt-resources-token': 'valid-token' },
    });

    (verifyWithDefaultSecret as jest.Mock).mockImplementation(() => ({
      workspace: { workspaceId: workspace.id, teamId: team.id },
      sharedRootFolderId: folder.uuid,
      sharedWithType: SharedWithType.WorkspaceTeam,
    }));

    jest
      .spyOn(guard, 'isWorkspaceMemberAbleToPerfomAction')
      .mockResolvedValue(false);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('You cannot access this resource'),
    );
  });

  it('When decoded owner is not found, it should throw', async () => {
    const workspace = newWorkspace();
    const team = newWorkspaceTeam();
    const folder = newFolder();
    mockMetadata(reflector, { action: SharingActionName.ViewDetails });

    const context = createMockExecutionContext({
      user,
      headers: { 'internxt-resources-token': 'valid-token' },
    });

    (verifyWithDefaultSecret as jest.Mock).mockImplementation(() => ({
      workspace: { workspaceId: workspace.id, teamId: team.id },
      sharedRootFolderId: folder.uuid,
      sharedWithType: SharedWithType.WorkspaceTeam,
      owner: undefined,
    }));

    jest
      .spyOn(guard, 'isWorkspaceMemberAbleToPerfomAction')
      .mockResolvedValue(true);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Owner is required'),
    );
  });

  it('When resource owner is not found, it should throw', async () => {
    const workspace = newWorkspace();
    const team = newWorkspaceTeam();
    const folder = newFolder();
    mockMetadata(reflector, { action: SharingActionName.UploadFile });

    const context = createMockExecutionContext({
      user,
      headers: { 'internxt-resources-token': 'valid-token' },
    });

    (verifyWithDefaultSecret as jest.Mock).mockImplementation(() => ({
      workspace: { workspaceId: workspace.id, teamId: team.id },
      sharedRootFolderId: folder.uuid,
      sharedWithType: SharedWithType.WorkspaceTeam,
      owner: { uuid: user.uuid },
    }));

    jest
      .spyOn(guard, 'isWorkspaceMemberAbleToPerfomAction')
      .mockResolvedValue(true);
    jest.spyOn(userUseCases, 'findByUuid').mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('When user has individual permissions, it should allow access', async () => {
    const folder = newFolder();
    mockMetadata(reflector, { action: SharingActionName.UploadFile });

    const context = createMockExecutionContext({
      user,
      headers: { 'internxt-resources-token': 'valid-token' },
    });

    (verifyWithDefaultSecret as jest.Mock).mockImplementation(() => ({
      sharedRootFolderId: folder.uuid,
      sharedWithType: SharedWithType.WorkspaceTeam,
      owner: { uuid: user.uuid },
    }));

    jest.spyOn(guard, 'isUserAbleToPerfomAction').mockResolvedValue(true);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  describe('isWorkspaceMemberAbleToPerfomAction', () => {
    it('When workspace member is part of a team that allows the action, it should return true', async () => {
      const workspaceId = v4();
      const sharedRootFolderId = v4();
      const action = SharingActionName.UploadFile;
      const team = newWorkspaceTeam();

      workspaceUseCases.getTeamsUserBelongsTo.mockResolvedValue([team]);

      sharingUseCases.canPerfomAction.mockResolvedValue(true);

      const result = await guard.isWorkspaceMemberAbleToPerfomAction(
        user,
        workspaceId,
        sharedRootFolderId,
        action,
      );

      expect(result).toBe(true);
      expect(sharingUseCases.canPerfomAction).toHaveBeenCalledWith(
        [team.id],
        sharedRootFolderId,
        action,
        SharedWithType.WorkspaceTeam,
      );
      expect(workspaceUseCases.getTeamsUserBelongsTo).toHaveBeenCalledWith(
        user.uuid,
        workspaceId,
      );
    });

    it('When workspace member is not part of a team that allows the action, it should return true', async () => {
      const workspaceId = v4();
      const sharedRootFolderId = v4();
      const action = SharingActionName.UploadFile;
      const team = newWorkspaceTeam();

      workspaceUseCases.getTeamsUserBelongsTo.mockResolvedValue([team]);
      sharingUseCases.canPerfomAction.mockResolvedValue(false);

      const result = await guard.isWorkspaceMemberAbleToPerfomAction(
        user,
        workspaceId,
        sharedRootFolderId,
        action,
      );

      expect(result).toBe(false);
      expect(sharingUseCases.canPerfomAction).toHaveBeenCalledWith(
        [team.id],
        sharedRootFolderId,
        action,
        SharedWithType.WorkspaceTeam,
      );
      expect(workspaceUseCases.getTeamsUserBelongsTo).toHaveBeenCalledWith(
        user.uuid,
        workspaceId,
      );
    });
  });

  describe('isUserAbleToPerfomAction', () => {
    it('When user has permissions for the requested action, it should return true', async () => {
      const sharedRootFolderId = v4();
      const action = SharingActionName.UploadFile;

      sharingUseCases.canPerfomAction.mockResolvedValue(true);

      const result = await guard.isUserAbleToPerfomAction(
        user,
        sharedRootFolderId,
        action,
      );

      expect(result).toBe(true);
      expect(sharingUseCases.canPerfomAction).toHaveBeenCalledWith(
        user.uuid,
        sharedRootFolderId,
        action,
        SharedWithType.Individual,
      );
    });

    it('When user does not have permissions for the requested action, it should return false', async () => {
      const sharedRootFolderId = v4();
      const action = SharingActionName.UploadFile;

      sharingUseCases.canPerfomAction.mockResolvedValue(false);

      const result = await guard.isUserAbleToPerfomAction(
        user,
        sharedRootFolderId,
        action,
      );

      expect(result).toBe(false);
      expect(sharingUseCases.canPerfomAction).toHaveBeenCalledWith(
        user.uuid,
        sharedRootFolderId,
        action,
        SharedWithType.Individual,
      );
    });
  });

  describe('verifySharedItemAccess', () => {
    const requester = newUser({ attributes: { uuid: 'requester-uuid' } });
    const request = createMock<Request>();
    const context = createMock<ExecutionContext>();
    it('When decoded.isSharedItem is false, then it should return early without throwing an error', async () => {
      const decoded = { isSharedItem: false } as SharingAccessTokenData;

      await expect(
        guard.verifySharedItemAccess(decoded, requester, request, context),
      ).resolves.toBeUndefined();
    });

    it('When user is neither the owner nor shared with, then it should throw ForbiddenException', async () => {
      const decoded = {
        isSharedItem: true,
        owner: { uuid: 'owner-uuid' },
        sharedWithUserUuid: 'another-user-uuid',
        item: { type: 'file', uuid: 'item-uuid' },
      } as SharingAccessTokenData;

      jest.spyOn(guard, 'getSharedDataFromRequest').mockReturnValue({
        itemType: 'file',
        itemUuid: 'item-uuid',
      });

      await expect(
        guard.verifySharedItemAccess(decoded, requester, request, context),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When item type does not match, then it should throw ForbiddenException', async () => {
      const decoded = {
        isSharedItem: true,
        owner: { uuid: 'owner-uuid' },
        sharedWithUserUuid: 'requester-uuid',
        item: { type: 'folder', uuid: 'item-uuid' },
      } as SharingAccessTokenData;

      jest.spyOn(guard, 'getSharedDataFromRequest').mockReturnValue({
        itemType: 'file',
        itemUuid: 'item-uuid',
      });

      await expect(
        guard.verifySharedItemAccess(decoded, requester, request, context),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When item ID does not match, then it should throw ForbiddenException', async () => {
      const decoded = {
        isSharedItem: true,
        owner: { uuid: 'owner-uuid' },
        sharedWithUserUuid: 'requester-uuid',
        item: { type: 'file', uuid: 'item-uuid' },
      } as SharingAccessTokenData;

      jest.spyOn(guard, 'getSharedDataFromRequest').mockReturnValue({
        itemType: 'file',
        itemUuid: 'another-item-uuid',
      });

      await expect(
        guard.verifySharedItemAccess(decoded, requester, request, context),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When user is the owner, then it should not throw an error', async () => {
      const decoded = {
        isSharedItem: true,
        owner: { uuid: 'requester-uuid' },
        sharedWithUserUuid: 'another-user-uuid',
        item: { type: 'file', uuid: 'item-uuid' },
      } as SharingAccessTokenData;

      jest.spyOn(guard, 'getSharedDataFromRequest').mockReturnValue({
        itemType: 'file',
        itemUuid: 'item-uuid',
      });

      await expect(
        guard.verifySharedItemAccess(decoded, requester, request, context),
      ).resolves.toBeUndefined();
    });

    it('When user is shared with, then it should not throw an error', async () => {
      const decoded = {
        isSharedItem: true,
        owner: { uuid: 'owner-uuid' },
        sharedWithUserUuid: 'requester-uuid',
        item: { type: 'file', uuid: 'item-uuid' },
      } as SharingAccessTokenData;

      jest.spyOn(guard, 'getSharedDataFromRequest').mockReturnValue({
        itemType: 'file',
        itemUuid: 'item-uuid',
      });

      await expect(
        guard.verifySharedItemAccess(decoded, requester, request, context),
      ).resolves.toBeUndefined();
    });
  });
});

const createMockExecutionContext = (requestData: any): ExecutionContext => {
  return {
    getHandler: () => ({
      name: 'endPointHandler',
    }),
    switchToHttp: () => ({
      getRequest: () => requestData,
    }),
  } as unknown as ExecutionContext;
};

const mockMetadata = (reflector: Reflector, metadata: PermissionsOptions) => {
  jest.spyOn(reflector, 'get').mockImplementation((key) => {
    if (key === PermissionsMetadataName) {
      return metadata;
    }
  });
};
