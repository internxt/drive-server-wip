import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { BadRequestException } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesUsecases } from './workspaces.usecase';
import { WorkspaceRole } from './guards/workspace-required-access.decorator';
import {
  newUser,
  newWorkspace,
  newWorkspaceInvite,
  newWorkspaceTeamUser,
  newWorkspaceUser,
} from '../../../test/fixtures';
import { v4 } from 'uuid';
import { WorkspaceUserMemberDto } from './dto/workspace-user-member.dto';
import { SharingService } from '../sharing/sharing.service';
import { CreateWorkspaceFolderDto } from './dto/create-workspace-folder.dto';
import { WorkspaceItemType } from './attributes/workspace-items-users.attributes';

describe('Workspace Controller', () => {
  let workspacesController: WorkspacesController;
  let workspacesUsecases: DeepMocked<WorkspacesUsecases>;
  let sharingUseCases: DeepMocked<SharingService>;

  beforeEach(async () => {
    workspacesUsecases = createMock<WorkspacesUsecases>();
    sharingUseCases = createMock<SharingService>();

    workspacesController = new WorkspacesController(
      workspacesUsecases,
      sharingUseCases,
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

      await workspacesController.acceptWorkspaceInvitation(user, {
        inviteId: invite.id,
      });

      expect(workspacesUsecases.acceptWorkspaceInvite).toHaveBeenCalledWith(
        user,
        invite.id,
      );
    });
  });

  describe('DELETE /:workspaceId/members/leave', () => {
    const user = newUser();
    it('When a member leaves workspace, then return', async () => {
      const workspace = newWorkspace({ owner: user });

      await expect(
        workspacesController.leaveWorkspace(user, workspace.id),
      ).resolves.toBeTruthy();
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
    const file: Express.Multer.File | any = {
      stream: undefined,
      fieldname: undefined,
      originalname: undefined,
      encoding: undefined,
      mimetype: undefined,
      size: undefined,
      filename: undefined,
      destination: undefined,
      path: undefined,
      buffer: undefined,
    };

    it('When workspaceId is null, throw error.', async () => {
      const workspaceId = null;
      jest
        .spyOn(workspacesUsecases, 'upsertAvatar')
        .mockRejectedValue(BadRequestException);

      await expect(
        workspacesController.uploadAvatar(file, workspaceId),
      ).rejects.toThrow();
    });

    it('When Multer does not return the key field in the file then the file was not uploaded to s3 and we should raise an error', async () => {
      const workspace = newWorkspace();
      file.key = null;
      await expect(
        workspacesController.uploadAvatar(file, workspace.id),
      ).rejects.toThrow();
    });

    it('When Multer returns the key field in the file then the file was uploaded to s3 and we must save the key', async () => {
      const workspace = newWorkspace();
      file.key = newAvatarKey;
      await workspacesController.uploadAvatar(file, workspace.id);
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

  describe('GET /:workspaceId/teams/:teamId/shared/files', () => {
    it('When shared files are requested, then it should call the service with the respective arguments', async () => {
      const user = newUser();
      const teamId = v4();
      const workspaceId = v4();
      const orderBy = 'createdAt:ASC';
      const page = 1;
      const perPage = 50;
      const order = [['createdAt', 'ASC']];

      await workspacesController.getSharedFiles(
        workspaceId,
        teamId,
        user,
        orderBy,
        page,
        perPage,
      );

      expect(sharingUseCases.getSharedFilesInWorkspaces).toHaveBeenCalledWith(
        user,
        workspaceId,
        teamId,
        page,
        perPage,
        order,
      );
    });
  });

  describe('GET /:workspaceId/teams/:teamId/shared/folders', () => {
    it('When shared folders are requested, then it should call the service with the respective arguments', async () => {
      const user = newUser();
      const teamId = v4();
      const workspaceId = v4();
      const orderBy = 'createdAt:ASC';
      const page = 1;
      const perPage = 50;
      const order = [['createdAt', 'ASC']];

      await workspacesController.getSharedFolders(
        workspaceId,
        teamId,
        user,
        orderBy,
        page,
        perPage,
      );

      expect(sharingUseCases.getSharedFoldersInWorkspace).toHaveBeenCalledWith(
        user,
        workspaceId,
        teamId,
        page,
        perPage,
        order,
      );
    });
  });

  describe('GET /:workspaceId/teams/:teamId/shared/:sharedFolderId/files', () => {
    it('When files inside a shared folder are requested, then it should call the service with the respective arguments', async () => {
      const user = newUser();
      const workspaceId = v4();
      const teamId = v4();
      const sharedFolderId = v4();
      const orderBy = 'createdAt:ASC';
      const token = 'token';
      const page = 1;
      const perPage = 50;
      const order = [['createdAt', 'ASC']];

      await workspacesController.getFilesInsideSharedFolder(
        workspaceId,
        teamId,
        user,
        sharedFolderId,
        { token, page, perPage, orderBy },
      );

      expect(workspacesUsecases.getItemsInSharedFolder).toHaveBeenCalledWith(
        workspaceId,
        teamId,
        user,
        sharedFolderId,
        WorkspaceItemType.File,
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
        createFolderDto,
      );

      expect(workspacesUsecases.createFolder).toHaveBeenCalledWith(
        user,
        workspaceId,
        createFolderDto,
      );
    });
  });

  describe('GET /:workspaceId', () => {
    it('When a workspace is requested, then it should return the workspace data', async () => {
      const user = newUser();
      const workspace = newWorkspace();

      jest
        .spyOn(workspacesUsecases, 'getWorkspaceDetails')
        .mockResolvedValueOnce(workspace.toJSON());

      await expect(
        workspacesController.getWorkspaceDetails(workspace.id, user),
      ).resolves.toEqual(workspace.toJSON());
    });
  });
});
