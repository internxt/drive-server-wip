import { type DeepMocked, createMock } from '@golevelup/ts-jest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { type WorkspacesUsecases } from './workspaces.usecase';
import { WorkspaceRole } from './guards/workspace-required-access.decorator';
import {
  newUser,
  newWorkspace,
  newWorkspaceInvite,
  newWorkspaceTeamUser,
  newWorkspaceUser,
} from '../../../test/fixtures';
import { v4 } from 'uuid';
import { type WorkspaceUserMemberDto } from './dto/workspace-user-member.dto';
import { type CreateWorkspaceFolderDto } from './dto/create-workspace-folder.dto';
import { WorkspaceItemType } from './attributes/workspace-items-users.attributes';
import { type StorageNotificationService } from '../../externals/notifications/storage.notifications.service';
import { type CreateWorkspaceFileDto } from './dto/create-workspace-file.dto';
import { type WorkspaceLog } from './domains/workspace-log.domain';
import { type GetWorkspaceLogsDto } from './dto/get-workspace-logs';
import {
  WorkspaceLogPlatform,
  WorkspaceLogType,
} from './attributes/workspace-logs.attributes';
import { ClientEnum } from '../../common/enums/platform.enum';

describe('Workspace Controller', () => {
  let workspacesController: WorkspacesController;
  let workspacesUsecases: DeepMocked<WorkspacesUsecases>;
  let storageNotificationService: DeepMocked<StorageNotificationService>;

  beforeEach(async () => {
    workspacesUsecases = createMock<WorkspacesUsecases>();
    storageNotificationService = createMock<StorageNotificationService>();

    workspacesController = new WorkspacesController(
      workspacesUsecases,
      storageNotificationService,
    );
  });

  it('should be defined', () => {
    expect(workspacesController).toBeDefined();
  });

  describe('PATCH /:workspaceId/teams/:teamId/members/:memberId/role', () => {
    it('When role is updated correctly, then it works', async () => {
      const userUuid = v4();
      const teamId = v4();
      const workspaceId = v4();

      await expect(
        workspacesController.changeMemberRole(workspaceId, teamId, userUuid, {
          role: WorkspaceRole.MEMBER,
        }),
      ).resolves.toBeTruthy();

      expect(workspacesUsecases.changeUserRole).toHaveBeenCalledWith(
        workspaceId,
        teamId,
        userUuid,
        {
          role: WorkspaceRole.MEMBER,
        },
      );
    });
  });

  describe('PATCH /:workspaceId/members/:memberId/activate', () => {
    it('When user is activated, then it should activate the correct user ', async () => {
      const userUuid = v4();
      const workspaceId = v4();

      await expect(
        workspacesController.activateWorkspaceMember(userUuid, workspaceId),
      ).resolves.toBeTruthy();

      expect(workspacesUsecases.activateWorkspaceUser).toHaveBeenCalledWith(
        userUuid,
        workspaceId,
      );
    });
  });

  describe('PATCH /:workspaceId/setup', () => {
    const user = newUser();
    const workspaceDatDto = {
      name: 'Test Workspace',
      description: 'Workspace description',
      address: 'Workspace Address',
      encryptedMnemonic: 'encryptedMnemonic',
    };

    it('Workspace is set up correctly, then it works', async () => {
      await expect(
        workspacesController.setupWorkspace(user, v4(), workspaceDatDto),
      ).resolves.toBeTruthy();
    });
  });

  describe('GET /', () => {
    it('When available workspaces are requested, then it should return workspaces and user data', async () => {
      const user = newUser();
      const workspace = newWorkspace({
        attributes: { setupCompleted: true },
      });
      const workspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user.uuid,
        attributes: { deactivated: false },
      }).toJSON();

      workspacesUsecases.getAvailableWorkspaces.mockResolvedValueOnce({
        availableWorkspaces: [{ workspace, workspaceUser }],
        pendingWorkspaces: [],
      });
      await expect(
        workspacesController.getAvailableWorkspaces(user),
      ).resolves.toEqual({
        availableWorkspaces: [{ workspace, workspaceUser }],
        pendingWorkspaces: [],
      });
    });
  });

  describe('GET /:workspaceId/invitations', () => {
    it('When workspace invites are requested, then it should return successfully', async () => {
      const user = newUser();
      const anotherUser = newUser();
      const workspace = newWorkspace();

      const invites = [
        newWorkspaceInvite({ invitedUser: user.uuid }),
        newWorkspaceInvite({ invitedUser: anotherUser.uuid }),
      ];

      workspacesUsecases.getWorkspacePendingInvitations.mockResolvedValueOnce([
        {
          ...invites[0],
          user: { ...user },
          isGuessInvite: false,
        },
        {
          ...invites[1],
          user: { ...anotherUser },
          isGuessInvite: false,
        },
      ]);

      await expect(
        workspacesController.getWorkspacePendingInvitations(
          { limit: 10, offset: 0 },
          workspace.id,
        ),
      ).resolves.toEqual([
        {
          ...invites[0],
          user: { ...user },
          isGuessInvite: false,
        },
        {
          ...invites[1],
          user: { ...anotherUser },
          isGuessInvite: false,
        },
      ]);
    });
  });

  describe('GET /invitations', () => {
    it('When user invites are requested, then it should return successfully', async () => {
      const user = newUser();
      const workspace = newWorkspace();
      const invite = newWorkspaceInvite({
        invitedUser: user.uuid,
        workspaceId: workspace.id,
      });
      const limit = 10;
      const offset = 0;

      const invites = [{ ...invite, workspace: workspace.toJSON() }];

      workspacesUsecases.getUserInvites.mockResolvedValueOnce(invites);

      await expect(
        workspacesController.getUserInvitations(user, { limit, offset }),
      ).resolves.toEqual(invites);
    });
  });

  describe('PATCH /teams/:teamId', () => {
    it('When teamId is valid and update is successful, then resolve', async () => {
      await expect(
        workspacesController.editTeam(v4(), { name: 'new name' }),
      ).resolves.toBeTruthy();
    });
  });

  describe('POST /teams/:teamId/user/:userUuid', () => {
    it('When member is added succesfully, return member data', async () => {
      const teamUser = newWorkspaceTeamUser();

      workspacesUsecases.addMemberToTeam.mockResolvedValueOnce(teamUser);

      const newTeamMember = await workspacesController.addUserToTeam(
        v4(),
        v4(),
      );

      expect(newTeamMember).toEqual(teamUser);
    });
  });

  describe('DELETE /teams/:teamId/user/:userUuid', () => {
    it('When member is removed succesfully, then return', async () => {
      await expect(
        workspacesController.removeUserFromTeam(v4(), v4()),
      ).resolves.toBeTruthy();
    });
  });

  describe('GET /pending-setup', () => {
    it('When workspaces ready to be setup are requested, then it should return workspaces data', async () => {
      const owner = newUser();
      const workspace = newWorkspace({
        owner,
        attributes: { setupCompleted: false },
      });

      workspacesUsecases.getWorkspacesPendingToBeSetup.mockResolvedValueOnce([
        workspace,
      ]);
      await expect(
        workspacesController.getUserWorkspacesToBeSetup(owner),
      ).resolves.toEqual([workspace]);
    });
  });

  describe('POST /invitations/accept', () => {
    const user = newUser();
    it('When invitation is accepted successfully, then it returns.', async () => {
      const invite = newWorkspaceInvite({ invitedUser: user.uuid });
      const workspace = newWorkspace();
      const workspaceUser = newWorkspaceUser({
        memberId: user.uuid,
        workspaceId: workspace.id,
      });

      jest
        .spyOn(workspacesUsecases, 'acceptWorkspaceInvite')
        .mockResolvedValueOnce(workspaceUser.toJSON());

      jest
        .spyOn(workspacesUsecases, 'findById')
        .mockResolvedValueOnce(workspace);

      const clientId = 'test-client';
      await workspacesController.acceptWorkspaceInvitation(user, clientId, {
        inviteId: invite.id,
      });

      expect(workspacesUsecases.acceptWorkspaceInvite).toHaveBeenCalledWith(
        user,
        invite.id,
      );

      expect(storageNotificationService.workspaceJoined).toHaveBeenCalledWith({
        payload: { workspaceId: workspace.id, workspaceName: workspace.name },
        user,
        clientId,
      });
    });
  });

  describe('DELETE /:workspaceId/members/leave', () => {
    const user = newUser();
    it('When a member leaves workspace, then return', async () => {
      const workspace = newWorkspace({ owner: user });
      const clientId = ClientEnum.Web;

      workspacesUsecases.findById.mockResolvedValueOnce(workspace);

      await workspacesController.leaveWorkspace(user, clientId, workspace.id);

      expect(workspacesUsecases.leaveWorkspace).toHaveBeenCalledWith(
        workspace.id,
        user,
      );

      expect(storageNotificationService.workspaceLeft).toHaveBeenCalledWith({
        payload: { workspaceId: workspace.id, workspaceName: workspace.name },
        user,
        clientId,
      });
    });
  });

  describe('PATCH /:workspaceId', () => {
    it('When workspace details are updated successfully, then it should return.', async () => {
      const user = newUser();
      const workspace = newWorkspace({ owner: user });

      workspacesController.editWorkspaceDetails(workspace.id, user, {
        name: 'new name',
      });

      jest
        .spyOn(workspacesUsecases, 'editWorkspaceDetails')
        .mockResolvedValue(Promise.resolve());

      await expect(
        workspacesController.editWorkspaceDetails(workspace.id, user, {
          name: 'new name',
          description: 'new description',
          address: 'new address',
        }),
      ).resolves.toBeUndefined();

      expect(workspacesUsecases.editWorkspaceDetails).toHaveBeenCalledWith(
        workspace.id,
        user,
        {
          name: 'new name',
          description: 'new description',
          address: 'new address',
        },
      );
    });
  });
  describe('GET /:workspaceId/members', () => {
    const owner = newUser();
    const workspace = newWorkspace({
      owner,
      attributes: { setupCompleted: true },
    });

    it('When the workspaceId is missing then it should throw BadRequestException', async () => {
      const expectResponse = expect(async () => {
        await workspacesController.getWorkspaceMembers(null, owner);
      });
      expectResponse.rejects.toThrow(BadRequestException);
      expectResponse.rejects.toThrow('Invalid workspace ID');
    });

    it('When the user is null or empty then it should return null', async () => {
      const user = null;
      workspacesUsecases.getWorkspaceMembers.mockResolvedValue(null);

      const response = await workspacesController.getWorkspaceMembers(
        workspace.id,
        user,
      );
      expect(response).toBeNull();
    });

    it('When members are requested with "workspaceId" and "user", then it should return workspaces members data', async () => {
      const user1 = newUser();
      const user2 = newUser();

      const ownerWorkspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: owner.uuid,
        member: owner,
        attributes: { deactivated: false },
      });
      const userWorkspace1 = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user1.uuid,
        member: user1,
        attributes: { deactivated: false },
      });
      const userWorkspace2 = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user2.uuid,
        member: user2,
        attributes: { deactivated: true },
      });

      const mockResolvedValues = {
        activatedUsers: [
          {
            ...ownerWorkspaceUser.toJSON(),
            isOwner: true,
            isManager: true,
            freeSpace: ownerWorkspaceUser.getFreeSpace(),
            usedSpace: ownerWorkspaceUser.getUsedSpace(),
          },
          {
            ...userWorkspace1.toJSON(),
            isOwner: false,
            isManager: false,
            freeSpace: userWorkspace1.getFreeSpace(),
            usedSpace: userWorkspace1.getUsedSpace(),
          },
        ],
        disabledUsers: [
          {
            ...userWorkspace2.toJSON(),
            isOwner: false,
            isManager: false,
            freeSpace: userWorkspace2.getFreeSpace(),
            usedSpace: userWorkspace2.getUsedSpace(),
          },
        ],
      };
      workspacesUsecases.getWorkspaceMembers.mockResolvedValueOnce(
        mockResolvedValues,
      );

      await expect(
        workspacesController.getWorkspaceMembers(workspace.id, owner),
      ).resolves.toEqual(mockResolvedValues);

      expect(workspacesUsecases.getWorkspaceMembers).toHaveBeenCalledWith(
        workspace.id,
        undefined,
      );
    });

    it('When a search param is provided, then it should be used for querying workspace members', async () => {
      const user1 = newUser();
      const search = user1.name;

      const userWorkspace1 = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user1.uuid,
        member: user1,
        attributes: { deactivated: false },
      }).toJSON();

      const workspaceUsecase = jest.spyOn(
        workspacesUsecases,
        'getWorkspaceMembers',
      );

      const mockResolvedValues = {
        activatedUsers: [
          {
            ...userWorkspace1,
            isOwner: false,
            isManager: false,
            freeSpace: BigInt(15000).toString(),
            usedSpace: BigInt(0).toString(),
          },
        ] as unknown as WorkspaceUserMemberDto[],
        disabledUsers: [] as WorkspaceUserMemberDto[],
      };
      workspacesUsecases.getWorkspaceMembers.mockResolvedValueOnce(
        mockResolvedValues,
      );

      const data = await workspacesController.getWorkspaceMembers(
        workspace.id,
        owner,
        search,
      );
      expect(data).toEqual(mockResolvedValues);
      expect(workspaceUsecase).toHaveBeenCalledWith(workspace.id, search);
    });

    describe('GET /invitations/:inviteId/validate', () => {
      it('When invitation is validated successfully, then it returns.', async () => {
        const invite = newWorkspaceInvite();
        jest
          .spyOn(workspacesUsecases, 'validateWorkspaceInvite')
          .mockResolvedValueOnce(Promise.resolve(invite.id));

        await expect(
          workspacesController.validateWorkspaceInvitation(invite.id),
        ).resolves.toEqual(invite.id);
        expect(workspacesUsecases.validateWorkspaceInvite).toHaveBeenCalledWith(
          invite.id,
        );
      });
    });
  });

  describe('POST /:workspaceId/avatar', () => {
    const newAvatarKey = v4();
    const createMockFile = (key?: string): Express.MulterS3.File =>
      ({
        stream: undefined as any,
        fieldname: 'file',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1000,
        filename: 'test.jpg',
        destination: '',
        path: '',
        buffer: Buffer.from(''),
        key: key || '',
        bucket: 'test-bucket',
        acl: 'public-read',
        contentType: 'image/jpeg',
        contentDisposition: null,
        storageClass: 'STANDARD',
        serverSideEncryption: null,
        metadata: {},
        location: 'https://test-bucket.s3.amazonaws.com/test-key',
        etag: 'test-etag',
      }) as Express.MulterS3.File;

    it('When workspaceId is null, throw error.', async () => {
      const workspaceId = null;
      const mockFile = createMockFile(newAvatarKey);
      jest
        .spyOn(workspacesUsecases, 'upsertAvatar')
        .mockRejectedValue(BadRequestException);

      await expect(
        workspacesController.uploadAvatar(mockFile, workspaceId),
      ).rejects.toThrow();
    });

    it('When Multer does not return the key field in the file then the file was not uploaded to s3 and we should raise an error', async () => {
      const workspace = newWorkspace();
      const mockFile = createMockFile(); // Empty key
      await expect(
        workspacesController.uploadAvatar(mockFile, workspace.id),
      ).rejects.toThrow();
    });

    it('When Multer returns the key field in the file then the file was uploaded to s3 and we must save the key', async () => {
      const workspace = newWorkspace();
      const mockFile = createMockFile(newAvatarKey);
      await workspacesController.uploadAvatar(mockFile, workspace.id);
      expect(workspacesUsecases.upsertAvatar).toHaveBeenCalledWith(
        workspace.id,
        newAvatarKey,
      );
    });
  });

  describe('DELETE /:workspaceId/avatar', () => {
    it('When workspaceId is null, then it fails.', async () => {
      const workspaceId = null;
      jest
        .spyOn(workspacesUsecases, 'deleteAvatar')
        .mockRejectedValue(BadRequestException);

      await expect(
        workspacesController.deleteAvatar(workspaceId),
      ).rejects.toThrow();
    });

    it('When passing a workspace id, workspacesUsecases.deleteAvatar should be called and return resolve', async () => {
      const workspace = newWorkspace({
        avatar: v4(),
      });

      await expect(
        workspacesController.deleteAvatar(workspace.id),
      ).resolves.toBeTruthy();
    });
  });

  describe('GET /:workspaceId/shared/files', () => {
    const user = newUser();
    const workspaceId = v4();
    const orderBy = 'createdAt:ASC';
    const page = 1;
    const perPage = 50;
    const order = [['createdAt', 'ASC']];

    it('When files shared with user teams are requested, then it should call the service with the respective arguments', async () => {
      await workspacesController.getSharedFilesInWorkspace(
        workspaceId,
        user,
        orderBy,
        { page, perPage },
      );

      expect(workspacesUsecases.getSharedFilesInWorkspace).toHaveBeenCalledWith(
        user,
        workspaceId,
        {
          offset: page,
          limit: perPage,
          order,
        },
      );
    });
  });

  describe('GET /:workspaceId/shared/folders', () => {
    const user = newUser();
    const workspaceId = v4();
    const orderBy = 'createdAt:ASC';
    const page = 1;
    const perPage = 50;
    const order = [['createdAt', 'ASC']];

    it('When folders shared with user teams are requested, then it should call the service with the respective arguments', async () => {
      await workspacesController.getSharedFoldersInWorkspace(
        workspaceId,
        user,
        orderBy,
        { page, perPage },
      );

      expect(
        workspacesUsecases.getSharedFoldersInWorkspace,
      ).toHaveBeenCalledWith(user, workspaceId, {
        offset: page,
        limit: perPage,
        order,
      });
    });
  });

  describe('GET /:workspaceId/shared/:sharedFolderId/files', () => {
    it('When files inside a shared folder are requested, then it should call the service with the respective arguments', async () => {
      const user = newUser();
      const workspaceId = v4();
      const sharedFolderId = v4();
      const orderBy = 'createdAt:ASC';
      const token = 'token';
      const page = 1;
      const perPage = 50;
      const order = [['createdAt', 'ASC']];

      await workspacesController.getFilesInSharingFolder(
        workspaceId,
        user,
        sharedFolderId,
        { token, page, perPage, orderBy },
      );

      expect(workspacesUsecases.getItemsInSharedFolder).toHaveBeenCalledWith(
        workspaceId,
        user,
        sharedFolderId,
        WorkspaceItemType.File,
        token,
        { page, perPage, order },
      );
    });
  });

  describe('GET /:workspaceId/shared/:sharedFolderId/folders', () => {
    it('When folders inside a shared folder are requested, then it should call the service with the respective arguments', async () => {
      const user = newUser();
      const workspaceId = v4();
      const sharedFolderId = v4();
      const orderBy = 'createdAt:ASC';
      const token = 'token';
      const page = 1;
      const perPage = 50;
      const order = [['createdAt', 'ASC']];

      await workspacesController.getFoldersInSharingFolder(
        workspaceId,
        user,
        sharedFolderId,
        { token, page, perPage, orderBy },
      );

      expect(workspacesUsecases.getItemsInSharedFolder).toHaveBeenCalledWith(
        workspaceId,
        user,
        sharedFolderId,
        WorkspaceItemType.Folder,
        token,
        { page, perPage, order },
      );
    });
  });

  describe('POST /:workspaceId/folders', () => {
    it('When a folder is created successfully, then it should call the service with the respective arguments', async () => {
      const user = newUser();
      const workspaceId = v4();
      const createFolderDto: CreateWorkspaceFolderDto = {
        name: 'New Folder',
        parentFolderUuid: v4(),
      };

      await workspacesController.createFolder(
        workspaceId,
        user,
        'clientId',
        createFolderDto,
      );

      expect(workspacesUsecases.createFolder).toHaveBeenCalledWith(
        user,
        workspaceId,
        createFolderDto,
      );
    });
  });

  describe('POST /:workspaceId/files', () => {
    it('When a file is created successfully, then it should call the service with the respective arguments', async () => {
      const user = newUser();
      const workspaceId = v4();
      const createFileDto: CreateWorkspaceFileDto = {
        plainName: 'New File',
        folderUuid: v4(),
        bucket: v4(),
        fileId: v4(),
        encryptVersion: '',
        size: BigInt(100),
        type: 'pdf',
        modificationTime: new Date(),
      };

      await workspacesController.createFile(
        workspaceId,
        user,
        'clientId',
        createFileDto,
        undefined,
      );

      expect(workspacesUsecases.createFile).toHaveBeenCalledWith(
        user,
        workspaceId,
        createFileDto,
        undefined,
      );
    });
  });

  describe('GET /:workspaceId', () => {
    it('When a workspace is requested, then it should return the workspace data', async () => {
      const workspace = newWorkspace();

      jest
        .spyOn(workspacesUsecases, 'getWorkspaceDetails')
        .mockResolvedValueOnce(workspace.toJSON());

      await expect(
        workspacesController.getWorkspaceDetails(workspace.id),
      ).resolves.toEqual(workspace.toJSON());
    });
  });

  describe('DELETE /:workspaceId/members/:memberId', () => {
    it('When a member is removed from the workspace, then it should call the service with the respective arguments and send the workspaceLeft notification', async () => {
      const workspace = newWorkspace();
      const memberId = v4();
      const workspaceId = workspace.id;
      const member = newUser();
      const workspaceUser = newWorkspaceUser({
        memberId,
        workspaceId,
        member,
      });
      const clientId = ClientEnum.Web;

      jest
        .spyOn(workspacesUsecases, 'findById')
        .mockResolvedValueOnce(workspace);
      jest
        .spyOn(workspacesUsecases, 'findUserInWorkspace')
        .mockResolvedValueOnce(workspaceUser);

      await workspacesController.removeWorkspaceMember(
        workspaceId,
        memberId,
        clientId,
      );

      expect(workspacesUsecases.removeWorkspaceMember).toHaveBeenCalledWith(
        workspaceId,
        memberId,
      );

      expect(storageNotificationService.workspaceLeft).toHaveBeenCalledWith({
        payload: { workspaceId: workspace.id, workspaceName: workspace.name },
        user: member,
        clientId,
      });
    });
  });

  describe('GET /:workspaceId/trash', () => {
    it('When the workspace trash is requested, then it should call the service with the respective arguments', async () => {
      const user = newUser();
      const workspaceId = v4();
      const offset = 1;
      const limit = 50;
      const sort = 'plainName';
      const order = 'ASC';

      await workspacesController.getUserTrashedItems(
        workspaceId,
        user,
        {
          limit,
          offset,
        },
        WorkspaceItemType.File,
        'plainName',
        'ASC',
      );

      expect(
        workspacesUsecases.getWorkspaceUserTrashedItems,
      ).toHaveBeenCalledWith(
        user,
        workspaceId,
        WorkspaceItemType.File,
        limit,
        offset,
        [[sort, order]],
      );
    });
  });

  describe('GET /:workspaceId/fuzzy/:search', () => {
    it('When a fuzzy search is requested, then it should call the service with the respective arguments', async () => {
      const user = newUser();
      const workspaceId = v4();
      const search = 'search';

      await workspacesController.searchWorkspace(workspaceId, user, search, 0);

      expect(workspacesUsecases.searchWorkspaceContent).toHaveBeenCalledWith(
        user,
        workspaceId,
        search,
        0,
      );
    });
  });

  describe('GET /:workspaceId/access/logs', () => {
    const workspaceId = v4();
    const user = newUser({ attributes: { email: 'test@example.com' } });
    const date = new Date();
    const summary = true;
    const workspaceLogtoJson = {
      id: v4(),
      workspaceId,
      creator: user.uuid,
      type: WorkspaceLogType.Login,
      platform: WorkspaceLogPlatform.Web,
      entityId: null,
      createdAt: date,
      updatedAt: date,
    };
    const mockLogs: WorkspaceLog[] = [
      {
        ...workspaceLogtoJson,
        user: {
          id: 4,
          name: user.name,
          lastname: user.lastname,
          email: user.email,
          uuid: user.uuid,
        },
        workspace: {
          id: workspaceId,
          name: 'My Workspace',
        },
        file: null,
        folder: null,
        toJSON: () => ({ ...workspaceLogtoJson }),
      },
    ];

    it('when valid request is made, then should return access logs successfully', async () => {
      const workspaceLogDto: GetWorkspaceLogsDto = {
        limit: 10,
        offset: 0,
        summary,
      };

      jest.spyOn(workspacesUsecases, 'accessLogs').mockResolvedValue(mockLogs);

      const result = await workspacesController.accessLogs(
        workspaceId,
        user,
        workspaceLogDto,
      );

      expect(result).toEqual(mockLogs);
      expect(workspacesUsecases.accessLogs).toHaveBeenCalledWith(
        workspaceId,
        { limit: 10, offset: 0 },
        undefined,
        undefined,
        undefined,
        summary,
        undefined,
      );
    });

    it('when invalid workspaceId is provided, then should throw', async () => {
      const invalidWorkspaceId = v4();
      const workspaceLogDto: GetWorkspaceLogsDto = {
        limit: 10,
        offset: 0,
        summary,
      };

      jest
        .spyOn(workspacesUsecases, 'accessLogs')
        .mockRejectedValue(new NotFoundException());

      await expect(
        workspacesController.accessLogs(
          invalidWorkspaceId,
          user,
          workspaceLogDto,
        ),
      ).rejects.toThrow();
    });

    it('when query parameters are provided, then should handle them correctly', async () => {
      const username = mockLogs[0].user.name;
      const workspaceLogDto: GetWorkspaceLogsDto = {
        limit: 10,
        offset: 0,
        member: mockLogs[0].user.name,
        activity: [WorkspaceLogType.Login],
        lastDays: 7,
        orderBy: 'createdAt:DESC',
        summary: false,
      };

      jest.spyOn(workspacesUsecases, 'accessLogs').mockResolvedValue(mockLogs);

      const result = await workspacesController.accessLogs(
        workspaceId,
        user,
        workspaceLogDto,
      );

      expect(result).toEqual(mockLogs);
      expect(workspacesUsecases.accessLogs).toHaveBeenCalledWith(
        workspaceId,
        { limit: 10, offset: 0 },
        username,
        [WorkspaceLogType.Login],
        7,
        false,
        [['createdAt', 'DESC']],
      );
    });
  });

  describe('getWorkspaceItemAncestors', () => {
    it('When provided with an invalid workspaceId then should throw', async () => {
      const user = newUser();
      const workspaceId = 'invalid-uuid';
      const itemType = WorkspaceItemType.File;
      const itemUuid = v4();
      const isSharedItem = true;

      jest
        .spyOn(workspacesUsecases, 'getWorkspaceItemAncestors')
        .mockRejectedValue(new NotFoundException('Workspace not found'));

      await expect(
        workspacesController.getWorkspaceItemAncestors(
          user,
          workspaceId,
          itemType,
          itemUuid,
          isSharedItem,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('When provided with valid parameters and isSharedItem is true then returns item ancestors', async () => {
      const user = newUser();
      const workspaceId = v4();
      const itemType = WorkspaceItemType.Folder;
      const itemUuid = v4();
      const isSharedItem = true;
      const expectedAncestors = [{ uuid: v4() }, { uuid: v4() }] as any;

      jest
        .spyOn(workspacesUsecases, 'getWorkspaceItemAncestors')
        .mockResolvedValue(expectedAncestors);

      const result = await workspacesController.getWorkspaceItemAncestors(
        user,
        workspaceId,
        itemType,
        itemUuid,
        isSharedItem,
      );

      expect(workspacesUsecases.getWorkspaceItemAncestors).toHaveBeenCalledWith(
        workspaceId,
        itemType,
        itemUuid,
      );
      expect(result).toEqual(expectedAncestors);
    });

    it('When isSharedItem is false and user is not the creator then should throw', async () => {
      const user = newUser();
      const workspaceId = v4();
      const itemType = WorkspaceItemType.File;
      const itemUuid = v4();
      const isSharedItem = false;

      jest
        .spyOn(workspacesUsecases, 'isUserCreatorOfItem')
        .mockResolvedValue(false);

      await expect(
        workspacesController.getWorkspaceItemAncestors(
          user,
          workspaceId,
          itemType,
          itemUuid,
          isSharedItem,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When isSharedItem is false and user is the creator then returns item ancestors', async () => {
      const user = newUser();
      const workspaceId = v4();
      const itemType = WorkspaceItemType.File;
      const itemUuid = v4();
      const isSharedItem = false;
      const expectedAncestors = [{ uuid: v4() }, { uuid: v4() }] as any;

      jest
        .spyOn(workspacesUsecases, 'isUserCreatorOfItem')
        .mockResolvedValue(true);
      jest
        .spyOn(workspacesUsecases, 'getWorkspaceItemAncestors')
        .mockResolvedValue(expectedAncestors);

      const result = await workspacesController.getWorkspaceItemAncestors(
        user,
        workspaceId,
        itemType,
        itemUuid,
        isSharedItem,
      );

      expect(workspacesUsecases.getWorkspaceItemAncestors).toHaveBeenCalledWith(
        workspaceId,
        itemType,
        itemUuid,
      );
      expect(result).toEqual(expectedAncestors);
    });
  });
});
