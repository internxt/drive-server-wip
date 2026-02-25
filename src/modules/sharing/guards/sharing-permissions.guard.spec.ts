import { type DeepMocked, createMock } from '@golevelup/ts-jest';
import {
  type ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import { type UserUseCases } from '../../user/user.usecase';
import { type SharingService } from '../../sharing/sharing.service';
import { type WorkspacesUsecases } from '../../workspaces/workspaces.usecase';
import { SharingPermissionsGuard } from './sharing-permissions.guard';

import { verifyWithDefaultSecret } from '../../../lib/jwt';
import {
  SharedWithType,
  SharingActionName,
} from '../../sharing/sharing.domain';
import {
  PermissionsMetadataName,
  type PermissionsOptions,
} from './sharing-permissions.decorator';

import {
  newFolder,
  newUser,
  newWorkspace,
  newWorkspaceTeam,
} from '../../../../test/fixtures';
import { v4 } from 'uuid';
import { type SharingAccessTokenData } from './sharings-token.interface';

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
    jest.spyOn(guard, 'getSharedDataFromRequest').mockReturnValue({
      itemType: 'file',
      itemUuid: 'item-uuid',
    });
    (verifyWithDefaultSecret as jest.Mock).mockReturnValue(decoded);
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
    jest.spyOn(guard, 'getSharedDataFromRequest').mockReturnValue({
      itemType: 'file',
      itemUuid: 'item-uuid',
    });
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
    jest.spyOn(guard, 'getSharedDataFromRequest').mockReturnValue({
      itemType: 'file',
      itemUuid: 'item-uuid',
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
    jest.spyOn(guard, 'getSharedDataFromRequest').mockReturnValue({
      itemType: 'file',
      itemUuid: 'item-uuid',
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
    jest.spyOn(guard, 'getSharedDataFromRequest').mockReturnValue({
      itemType: 'file',
      itemUuid: 'item-uuid',
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
    jest.spyOn(guard, 'getSharedDataFromRequest').mockReturnValue({
      itemType: 'file',
      itemUuid: 'item-uuid',
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
    jest.spyOn(guard, 'getSharedDataFromRequest').mockReturnValue({
      itemType: 'file',
      itemUuid: 'item-uuid',
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

  describe('getOwnerByItemUuid', () => {
    const itemUuid = 'item-uuid';
    const owner = newUser();
    const sharing = { ownerId: owner.uuid } as any;

    it('When sharing is found, then return the owner', async () => {
      jest.spyOn(sharingUseCases, 'findSharingBy').mockResolvedValue(sharing);
      jest.spyOn(userUseCases, 'getUser').mockResolvedValue(owner);

      const result = await guard.getOwnerByItemUuid(itemUuid);
      expect(result).toEqual(owner);
      expect(sharingUseCases.findSharingBy).toHaveBeenCalledWith({
        itemId: itemUuid,
      });
      expect(userUseCases.getUser).toHaveBeenCalledWith(owner.uuid);
    });

    it('When sharing is not found, then throw an error', async () => {
      jest.spyOn(sharingUseCases, 'findSharingBy').mockResolvedValue(null);

      await expect(guard.getOwnerByItemUuid(itemUuid)).rejects.toThrow(
        'Sharing item not found',
      );
      expect(sharingUseCases.findSharingBy).toHaveBeenCalledWith({
        itemId: itemUuid,
      });
    });

    it('When findSharingBy throws an error, then propagate the error', async () => {
      const errorMessage = 'Database error';

      jest
        .spyOn(sharingUseCases, 'findSharingBy')
        .mockRejectedValue(new Error(errorMessage));

      await expect(guard.getOwnerByItemUuid(itemUuid)).rejects.toThrow(
        errorMessage,
      );
      expect(sharingUseCases.findSharingBy).toHaveBeenCalledWith({
        itemId: itemUuid,
      });
    });

    it('When getUser throws an error, then propagate the error', async () => {
      const errorMessage = 'User not found';

      jest.spyOn(sharingUseCases, 'findSharingBy').mockResolvedValue(sharing);
      jest
        .spyOn(userUseCases, 'getUser')
        .mockRejectedValue(new Error(errorMessage));

      await expect(guard.getOwnerByItemUuid(itemUuid)).rejects.toThrow(
        errorMessage,
      );
      expect(sharingUseCases.findSharingBy).toHaveBeenCalledWith({
        itemId: itemUuid,
      });
      expect(userUseCases.getUser).toHaveBeenCalledWith(owner.uuid);
    });
  });

  describe('getSharedDataFromRequest', () => {
    it('When called, then return extracted data', () => {
      const request = { headers: {}, body: {} } as Request;
      const context = {} as ExecutionContext;
      const extractedData = { someData: 'value' };

      jest
        .spyOn(guard, 'getSharedDataFromRequest')
        .mockReturnValue(extractedData);

      const result = guard.getSharedDataFromRequest(request, context);
      expect(result).toEqual(extractedData);
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
