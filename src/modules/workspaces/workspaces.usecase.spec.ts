import { Test, TestingModule } from '@nestjs/testing';
import { SequelizeWorkspaceRepository } from './repositories/workspaces.repository';
import { SequelizeUserRepository } from '../user/user.repository';
import { UserUseCases } from '../user/user.usecase';
import { MailerService } from '../../externals/mailer/mailer.service';
import { ConfigService } from '@nestjs/config';
import { createMock } from '@golevelup/ts-jest';
import { WorkspacesUsecases } from './workspaces.usecase';
import {
  newFile,
  newFolder,
  newUser,
  newWorkspace,
  newWorkspaceInvite,
  newWorkspaceItemUser,
  newWorkspaceTeam,
  newWorkspaceTeamUser,
  newWorkspaceUser,
} from '../../../test/fixtures';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PreCreatedUser } from '../user/pre-created-user.domain';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { SequelizeWorkspaceTeamRepository } from './repositories/team.repository';
import { WorkspaceRole } from './guards/workspace-required-access.decorator';
import { WorkspaceTeamUser } from './domains/workspace-team-user.domain';
import { SequelizeWorkspaceItemsUsersRepository } from './repositories/items-users.repository';
import { FolderUseCases } from '../folder/folder.usecase';
import { CreateWorkspaceFolderDto } from './dto/create-workspace-folder.dto';
import { WorkspaceItemType } from './attributes/workspace-items-users.attributes';
import { FileUseCases } from '../file/file.usecase';
import { CreateWorkspaceFileDto } from './dto/create-workspace-file.dto';
import { FileStatus } from '../file/file.domain';
import { v4 } from 'uuid';

jest.mock('../../middlewares/passport', () => {
  const originalModule = jest.requireActual('../../middlewares/passport');
  return {
    __esModule: true,
    ...originalModule,
    Sign: jest.fn(() => 'newToken'),
    SignEmail: jest.fn(() => 'token'),
  };
});

describe('WorkspacesUsecases', () => {
  let service: WorkspacesUsecases;
  let workspaceRepository: SequelizeWorkspaceRepository;
  let teamRepository: SequelizeWorkspaceTeamRepository;
  let userRepository: SequelizeUserRepository;
  let userUsecases: UserUseCases;
  let mailerService: MailerService;
  let networkService: BridgeService;
  let configService: ConfigService;
  let workspaceItemsUsersRepository: SequelizeWorkspaceItemsUsersRepository;
  let folderUseCases: FolderUseCases;
  let fileUseCases: FileUseCases;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkspacesUsecases],
    })
      .useMocker(createMock)
      .compile();

    service = module.get<WorkspacesUsecases>(WorkspacesUsecases);
    workspaceRepository = module.get<SequelizeWorkspaceRepository>(
      SequelizeWorkspaceRepository,
    );
    teamRepository = module.get<SequelizeWorkspaceTeamRepository>(
      SequelizeWorkspaceTeamRepository,
    );
    userRepository = module.get<SequelizeUserRepository>(
      SequelizeUserRepository,
    );
    userUsecases = module.get<UserUseCases>(UserUseCases);
    mailerService = module.get<MailerService>(MailerService);
    networkService = module.get<BridgeService>(BridgeService);
    configService = module.get<ConfigService>(ConfigService);
    workspaceItemsUsersRepository =
      module.get<SequelizeWorkspaceItemsUsersRepository>(
        SequelizeWorkspaceItemsUsersRepository,
      );
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
    fileUseCases = module.get<FileUseCases>(FileUseCases);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('inviteUserToWorkspace', () => {
    const user = newUser();

    it('When workspace does not exist, then it should throw', async () => {
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValueOnce(null);

      await expect(
        service.inviteUserToWorkspace(user, 'workspace-id', {
          invitedUser: 'test@example.com',
          spaceLimit: BigInt(1024),
          encryptionKey: 'Dasdsadas',
          encryptionAlgorithm: 'dadads',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user is not registered or precreated, then it should throw', async () => {
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValueOnce(null);
      jest.spyOn(userUsecases, 'findByEmail').mockResolvedValueOnce(null);
      jest
        .spyOn(userUsecases, 'findPreCreatedByEmail')
        .mockResolvedValueOnce(null);

      await expect(
        service.inviteUserToWorkspace(user, 'workspace-id', {
          invitedUser: 'test@example.com',
          spaceLimit: BigInt(1024),
          encryptionKey: 'Dasdsadas',
          encryptionAlgorithm: 'dadads',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user is precreated, then it should be successfully invited', async () => {
      const workspace = newWorkspace();
      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValueOnce(workspace);
      jest.spyOn(userUsecases, 'findByEmail').mockResolvedValueOnce(null);
      jest.spyOn(userUsecases, 'findPreCreatedByEmail').mockResolvedValueOnce({
        uuid: user.uuid,
        email: user.email,
      } as PreCreatedUser);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValueOnce(null);
      jest.spyOn(service, 'isWorkspaceFull').mockResolvedValueOnce(false);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(user);
      jest
        .spyOn(service, 'getAssignableSpaceInWorkspace')
        .mockResolvedValueOnce(BigInt(6000000));
      jest.spyOn(configService, 'get').mockResolvedValueOnce('secret' as never);
      jest
        .spyOn(mailerService, 'sendWorkspaceUserExternalInvitation')
        .mockResolvedValueOnce(undefined);

      await expect(
        service.inviteUserToWorkspace(user, 'workspace-id', {
          invitedUser: 'test@example.com',
          spaceLimit: BigInt(1024),
          encryptionKey: '',
          encryptionAlgorithm: '',
        }),
      ).resolves.not.toThrow();
      expect(
        mailerService.sendWorkspaceUserExternalInvitation,
      ).toHaveBeenCalled();
    });

    it('When user is already registered, then it should be successfully invited', async () => {
      const workspace = newWorkspace();
      const invitedUser = newUser();
      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValueOnce(workspace);
      jest
        .spyOn(userUsecases, 'findByEmail')
        .mockResolvedValueOnce(invitedUser);
      jest
        .spyOn(userUsecases, 'findPreCreatedByEmail')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValueOnce(null);
      jest.spyOn(service, 'isWorkspaceFull').mockResolvedValueOnce(false);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(user);
      jest
        .spyOn(service, 'getAssignableSpaceInWorkspace')
        .mockResolvedValueOnce(BigInt(6000000));
      jest
        .spyOn(mailerService, 'sendWorkspaceUserInvitation')
        .mockResolvedValueOnce(undefined);
      jest.spyOn(configService, 'get').mockResolvedValue('secret' as never);

      await expect(
        service.inviteUserToWorkspace(user, 'workspace-id', {
          invitedUser: 'test@example.com',
          spaceLimit: BigInt(1024),
          encryptionKey: '',
          encryptionAlgorithm: '',
        }),
      ).resolves.not.toThrow();
      expect(mailerService.sendWorkspaceUserInvitation).toHaveBeenCalled();
    });

    it('When workspace has no more slots left, then it should throw', async () => {
      const workspace = newWorkspace();
      const user = newUser();

      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValueOnce(workspace);
      jest.spyOn(userUsecases, 'findByEmail').mockResolvedValueOnce(user);
      jest
        .spyOn(userUsecases, 'findPreCreatedByEmail')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValueOnce(null);
      jest.spyOn(service, 'isWorkspaceFull').mockResolvedValueOnce(true);

      await expect(
        service.inviteUserToWorkspace(user, workspace.id, {
          invitedUser: 'test@example.com',
          spaceLimit: BigInt(1024),
          encryptionKey: 'encryptionKey',
          encryptionAlgorithm: 'RSA',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('When user is already part of the workspace, then it should throw', async () => {
      const user = newUser();
      const workspace = newWorkspace();
      const invitedUser = newUser();

      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValueOnce(workspace);
      jest
        .spyOn(userUsecases, 'findByEmail')
        .mockResolvedValueOnce(invitedUser);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(newWorkspaceUser());

      await expect(
        service.inviteUserToWorkspace(user, workspace.id, {
          invitedUser: invitedUser.email,
          spaceLimit: BigInt(1024),
          encryptionKey: 'encryptionKey',
          encryptionAlgorithm: 'RSA',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('When user is already invited to the workspace, then it should throw', async () => {
      const invitedUser = newUser();
      const workspace = newWorkspace();
      const invitedUserEmail = 'alreadyInvited@example.com';
      const existingInvite = newWorkspaceInvite({
        invitedUser: invitedUserEmail,
      });

      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValueOnce(workspace);
      jest
        .spyOn(userUsecases, 'findByEmail')
        .mockResolvedValueOnce(invitedUser);
      jest
        .spyOn(userUsecases, 'findPreCreatedByEmail')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(workspaceRepository, 'findInvite')
        .mockResolvedValueOnce(existingInvite);

      await expect(
        service.inviteUserToWorkspace(user, workspace.id, {
          invitedUser: invitedUserEmail,
          spaceLimit: BigInt(1024),
          encryptionKey: 'encryptionKey',
          encryptionAlgorithm: 'RSA',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('When invitation space limit exceeds the assignable space, then it should throw', async () => {
      const invitedUser = newUser();
      const workspace = newWorkspace();
      const invitedUserEmail = 'newUser@example.com';
      const spaceLeft = 1024 * 1024 * 10;

      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValueOnce(workspace);
      jest
        .spyOn(userUsecases, 'findByEmail')
        .mockResolvedValueOnce(invitedUser);
      jest
        .spyOn(userUsecases, 'findPreCreatedByEmail')
        .mockResolvedValueOnce(null);
      jest.spyOn(service, 'isWorkspaceFull').mockResolvedValueOnce(false);
      jest
        .spyOn(service, 'getAssignableSpaceInWorkspace')
        .mockResolvedValueOnce(BigInt(spaceLeft));
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValueOnce(null);

      await expect(
        service.inviteUserToWorkspace(user, workspace.id, {
          invitedUser: invitedUserEmail,
          spaceLimit: BigInt(spaceLeft + 1),
          encryptionKey: 'encryptionKey',
          encryptionAlgorithm: 'RSA',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setupWorkspace', () => {
    const user = newUser();

    it('When workspace does not exist, then it should throw', async () => {
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValueOnce(null);

      await expect(
        service.setupWorkspace(user, 'workspace-id', {
          name: 'Test Workspace',
          encryptedMnemonic: 'encryptedMnemonic',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('When workspace is being setup, then it should add the owner as user to the workspace', async () => {
      const owner = newUser();
      const workspace = newWorkspace({ owner });

      jest
        .spyOn(workspaceRepository, 'findOne')
        .mockResolvedValueOnce(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);

      await service.setupWorkspace(owner, 'workspace-id', {
        name: 'Test Workspace',
        encryptedMnemonic: 'encryptedMnemonic',
      });

      expect(workspaceRepository.addUserToWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: owner.uuid,
        }),
      );
    });

    it('When workspace is being setup and user exists in workspace, then it should skip that step', async () => {
      const owner = newUser();
      const workspace = newWorkspace({ owner });
      const workspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: owner.uuid,
      });

      jest
        .spyOn(workspaceRepository, 'findOne')
        .mockResolvedValueOnce(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(workspaceUser);

      await service.setupWorkspace(owner, 'workspace-id', {
        name: 'Test Workspace',
        encryptedMnemonic: 'encryptedMnemonic',
      });

      expect(workspaceRepository.addUserToWorkspace).not.toHaveBeenCalled();
    });

    it('When workspace is being setup, then it should add the owner user to the default team', async () => {
      const owner = newUser();
      const workspace = newWorkspace({ owner });

      jest
        .spyOn(workspaceRepository, 'findOne')
        .mockResolvedValueOnce(workspace);
      jest.spyOn(teamRepository, 'getTeamUser').mockResolvedValueOnce(null);

      await service.setupWorkspace(owner, 'workspace-id', {
        name: 'Test Workspace',
        encryptedMnemonic: 'encryptedMnemonic',
      });

      expect(teamRepository.addUserToTeam).toHaveBeenCalledWith(
        workspace.defaultTeamId,
        owner.uuid,
      );
    });

    it('When workspace is being setup and user exists in default team, then it should skip that step', async () => {
      const owner = newUser();
      const workspace = newWorkspace({ owner });
      const workspaceTeamUser = new WorkspaceTeamUser({
        id: '',
        teamId: workspace.defaultTeamId,
        memberId: owner.uuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest
        .spyOn(workspaceRepository, 'findOne')
        .mockResolvedValueOnce(workspace);
      jest
        .spyOn(teamRepository, 'getTeamUser')
        .mockResolvedValueOnce(workspaceTeamUser);

      await service.setupWorkspace(owner, 'workspace-id', {
        name: 'Test Workspace',
        encryptedMnemonic: 'encryptedMnemonic',
      });

      expect(teamRepository.addUserToTeam).not.toHaveBeenCalled();
    });

    it('When workspace is being setup and an error ocurrs while setting user, then it should rollback and throw', async () => {
      const owner = newUser();
      const workspace = newWorkspace({ owner });

      jest
        .spyOn(workspaceRepository, 'findOne')
        .mockResolvedValueOnce(workspace);
      jest.spyOn(teamRepository, 'getTeamUser').mockResolvedValueOnce(null);

      jest
        .spyOn(teamRepository, 'addUserToTeam')
        .mockRejectedValueOnce(
          new Error('Error happened while adding user to team!'),
        );

      const spyRollbackFunction = jest.spyOn(
        service,
        'rollbackUserAddedToWorkspace',
      );

      await expect(
        service.setupWorkspace(owner, 'workspace-id', {
          name: 'Test Workspace',
          encryptedMnemonic: 'encryptedMnemonic',
        }),
      ).rejects.toThrow(InternalServerErrorException);
      expect(spyRollbackFunction).toHaveBeenCalledWith(owner.uuid, workspace);
    });

    it('When workspace is setup, then it should setup the workspace with defined data', async () => {
      const workspace = newWorkspace();
      const workspaceDatDto = {
        name: 'Test Workspace',
        description: 'Workspace description',
        address: 'Workspace Address',
        encryptedMnemonic: 'encryptedMnemonic',
      };

      jest
        .spyOn(workspaceRepository, 'findOne')
        .mockResolvedValueOnce(workspace);

      await service.setupWorkspace(user, workspace.id, workspaceDatDto);

      expect(workspaceRepository.updateBy).toHaveBeenCalledWith(
        {
          ownerId: user.uuid,
          id: workspace.id,
        },
        {
          name: workspaceDatDto.name,
          setupCompleted: true,
          address: workspaceDatDto.address,
          description: workspaceDatDto.description,
        },
      );
    });

    it('When workspace is setup and no defined data was sent, then it should use data already in workspace', async () => {
      const workspace = newWorkspace();
      const setupWorkspaceDto = {
        encryptedMnemonic: 'encryptedMnemonic',
      };

      jest
        .spyOn(workspaceRepository, 'findOne')
        .mockResolvedValueOnce(workspace);

      await service.setupWorkspace(user, workspace.id, setupWorkspaceDto);

      expect(workspaceRepository.updateBy).toHaveBeenCalledWith(
        {
          ownerId: user.uuid,
          id: workspace.id,
        },
        {
          name: workspace.name,
          setupCompleted: true,
          address: workspace.address,
          description: workspace.description,
        },
      );
    });
  });

  describe('isWorkspaceFull', () => {
    const workspaceId = 'workspace-id';
    it('When workspace has slots left, then workspace is not full', async () => {
      jest
        .spyOn(workspaceRepository, 'getWorkspaceUsersCount')
        .mockResolvedValue(5);
      jest
        .spyOn(workspaceRepository, 'getWorkspaceInvitationsCount')
        .mockResolvedValue(4);

      const isFull = await service.isWorkspaceFull(workspaceId);
      expect(isFull).toBe(false);
    });
    it('When workspace does not have slots left, then workspace is full', async () => {
      jest
        .spyOn(workspaceRepository, 'getWorkspaceUsersCount')
        .mockResolvedValue(10);
      jest
        .spyOn(workspaceRepository, 'getWorkspaceInvitationsCount')
        .mockResolvedValue(0);

      const isFull = await service.isWorkspaceFull(workspaceId);
      expect(isFull).toBe(true);
    });
  });

  describe('getAvailableWorkspaces', () => {
    it('When trying to get user available workspaces, then it should return ready workspaces and workspaces pending to be setup', async () => {
      const user = newUser();
      const workspace = newWorkspace({
        attributes: { setupCompleted: true },
      });
      const pendingSetupWorkspace = newWorkspace({
        attributes: { setupCompleted: false, ownerId: user.uuid },
      });
      const workspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user.uuid,
        attributes: { deactivated: false },
      });

      jest
        .spyOn(service, 'getWorkspacesPendingToBeSetup')
        .mockResolvedValueOnce([pendingSetupWorkspace]);
      jest
        .spyOn(workspaceRepository, 'findUserAvailableWorkspaces')
        .mockResolvedValueOnce([{ workspaceUser, workspace }]);
      const availableWorkspaces = await service.getAvailableWorkspaces(user);

      expect(availableWorkspaces).toEqual({
        availableWorkspaces: [{ workspaceUser, workspace }],
        pendingWorkspaces: [pendingSetupWorkspace],
      });
    });

    it('When there is no pending workspace, then it should return just available workspaces', async () => {
      const user = newUser();
      const workspace = newWorkspace({
        attributes: { setupCompleted: false },
      });
      const workspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user.uuid,
        attributes: { deactivated: false },
      });

      jest
        .spyOn(service, 'getWorkspacesPendingToBeSetup')
        .mockResolvedValueOnce([]);
      jest
        .spyOn(workspaceRepository, 'findUserAvailableWorkspaces')
        .mockResolvedValue([{ workspaceUser, workspace }]);

      const availableWorkspaces = await service.getAvailableWorkspaces(user);

      expect(availableWorkspaces).toEqual({
        availableWorkspaces: [],
        pendingWorkspaces: [],
      });
    });

    it('When trying to get user available workspaces, workspaces that have this user deactivated should not be returned', async () => {
      const user = newUser();
      const workspace = newWorkspace({
        attributes: { setupCompleted: true },
      });
      const workspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user.uuid,
        attributes: { deactivated: true },
      });

      jest
        .spyOn(service, 'getWorkspacesPendingToBeSetup')
        .mockResolvedValueOnce([]);
      jest
        .spyOn(workspaceRepository, 'findUserAvailableWorkspaces')
        .mockResolvedValue([{ workspaceUser, workspace }]);
      const availableWorkspaces = await service.getAvailableWorkspaces(user);

      expect(availableWorkspaces).toEqual({
        availableWorkspaces: [],
        pendingWorkspaces: [],
      });
    });
  });

  describe('getWorkspacesPendingToBeSetup', () => {
    it('When trying to get workspaces ready to be setup, then only workspaces that the user created should be retrieved', async () => {
      const owner = newUser();
      const setupWorkspace = newWorkspace({
        owner,
        attributes: { setupCompleted: false },
      });

      jest
        .spyOn(workspaceRepository, 'findAllBy')
        .mockResolvedValue([setupWorkspace]);

      const availableWorkspaces =
        await service.getWorkspacesPendingToBeSetup(owner);

      expect(workspaceRepository.findAllBy).toHaveBeenCalledWith({
        ownerId: owner.uuid,
        setupCompleted: false,
      });
      expect(availableWorkspaces).toEqual([setupWorkspace]);
    });
  });

  describe('rollbackUserAddedToWorkspace', () => {
    const owner = newUser();
    const workspace = newWorkspace({ owner });

    it('When rollback is successful, then error should not be returned', async () => {
      const rollbackError = await service.rollbackUserAddedToWorkspace(
        owner.uuid,
        workspace,
      );

      expect(workspaceRepository.deleteUserFromWorkspace).toHaveBeenCalledWith(
        owner.uuid,
        workspace.id,
      );
      expect(teamRepository.deleteUserFromTeam).toHaveBeenCalledWith(
        owner.uuid,
        workspace.defaultTeamId,
      );
      expect(rollbackError).toBeNull();
    });

    it('When rollback is not successful, then error should be returned', async () => {
      jest
        .spyOn(workspaceRepository, 'deleteUserFromWorkspace')
        .mockRejectedValueOnce(new Error());

      const rollbackError = await service.rollbackUserAddedToWorkspace(
        owner.uuid,
        workspace,
      );

      expect(rollbackError).toBeInstanceOf(Error);
    });
  });

  describe('acceptWorkspaceInvite', () => {
    const invitedUser = newUser();

    it('When invite is not found, then fail', async () => {
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(null);
      await expect(
        service.acceptWorkspaceInvite(invitedUser, 'anyUuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('When invite does not point to a valid workspace, then fail', async () => {
      const invite = newWorkspaceInvite({ invitedUser: invitedUser.uuid });

      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.acceptWorkspaceInvite(invitedUser, 'anyUuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('When user has an invite but it is already in workspace, then it should skip adding a new user and delete the invite', async () => {
      const workspace = newWorkspace();
      const workspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: invitedUser.uuid,
      });
      const invite = newWorkspaceInvite({
        invitedUser: invitedUser.uuid,
        workspaceId: workspace.id,
      });
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(workspaceUser);

      await service.acceptWorkspaceInvite(invitedUser, 'anyUuid');

      expect(workspaceRepository.addUserToWorkspace).not.toHaveBeenCalled();
      expect(workspaceRepository.deleteInviteBy).toHaveBeenCalledWith({
        id: invite.id,
      });
    });

    it('When invite is valid, then add user to workspace with respective space limit', async () => {
      const workspace = newWorkspace();
      const invite = newWorkspaceInvite({
        invitedUser: invitedUser.uuid,
        workspaceId: workspace.id,
        attributes: { spaceLimit: BigInt(1000) },
      });
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);

      await service.acceptWorkspaceInvite(invitedUser, 'anyUuid');

      expect(workspaceRepository.addUserToWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: invite.invitedUser,
          spaceLimit: invite.spaceLimit,
        }),
      );
    });

    it('When invite is valid, then add user to default team', async () => {
      const workspace = newWorkspace();
      const invite = newWorkspaceInvite({
        invitedUser: invitedUser.uuid,
        workspaceId: workspace.id,
      });
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);

      await service.acceptWorkspaceInvite(invitedUser, 'anyUuid');

      expect(teamRepository.addUserToTeam).toHaveBeenCalledWith(
        workspace.defaultTeamId,
        invitedUser.uuid,
      );
    });

    it('When invite is valid and an error is thrown while setting user in team, then it should rollback and throw', async () => {
      const workspace = newWorkspace();
      const invite = newWorkspaceInvite({
        invitedUser: invitedUser.uuid,
        workspaceId: workspace.id,
      });

      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(teamRepository, 'addUserToTeam')
        .mockRejectedValueOnce(
          new Error('Error happened while adding user to team!'),
        );

      const spyRollbackFunction = jest.spyOn(
        service,
        'rollbackUserAddedToWorkspace',
      );

      await expect(
        service.acceptWorkspaceInvite(invitedUser, 'anyUuid'),
      ).rejects.toThrow(InternalServerErrorException);
      expect(spyRollbackFunction).toHaveBeenCalledWith(
        invitedUser.uuid,
        workspace,
      );
    });

    it('When invite is valid and an error is thrown while setting user in workspace, then it should rollback and throw', async () => {
      const workspace = newWorkspace();
      const invite = newWorkspaceInvite({
        invitedUser: invitedUser.uuid,
        workspaceId: workspace.id,
      });

      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(workspaceRepository, 'addUserToWorkspace')
        .mockRejectedValueOnce(
          new Error('Error happened while adding user to workspace!'),
        );

      const spyRollbackFunction = jest.spyOn(
        service,
        'rollbackUserAddedToWorkspace',
      );

      await expect(
        service.acceptWorkspaceInvite(invitedUser, 'anyUuid'),
      ).rejects.toThrow(InternalServerErrorException);
      expect(spyRollbackFunction).toHaveBeenCalledWith(
        invitedUser.uuid,
        workspace,
      );
    });

    it('When invite is accepted, then it should be deleted aftewards', async () => {
      const workspace = newWorkspace();
      const invite = newWorkspaceInvite({
        invitedUser: invitedUser.uuid,
        workspaceId: workspace.id,
      });
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);

      await service.acceptWorkspaceInvite(invitedUser, 'anyUuid');

      expect(workspaceRepository.deleteInviteBy).toHaveBeenCalledWith({
        id: invite.id,
      });
    });
  });

  describe('removeWorkspaceInvite', () => {
    const invitedUser = newUser();

    it('When invite is not found, then fail', async () => {
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(null);
      await expect(
        service.removeWorkspaceInvite(invitedUser, 'anyUuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('When invite does not have a valid workspace, then fail', async () => {
      const invite = newWorkspaceInvite({ invitedUser: invitedUser.uuid });

      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.removeWorkspaceInvite(invitedUser, 'anyUuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('When user is not invited user and tries to delete the invite, then it should throw', async () => {
      const workspace = newWorkspace();
      const notInvitedUser = newUser();
      const invite = newWorkspaceInvite({
        invitedUser: invitedUser.uuid,
        workspaceId: workspace.id,
      });

      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);

      await expect(
        service.removeWorkspaceInvite(notInvitedUser, invite.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When user is not invited user but it is owner of the workspace, then it should success', async () => {
      const notInvitedUser = newUser();
      const workspace = newWorkspace({ owner: notInvitedUser });
      const invite = newWorkspaceInvite({
        invitedUser: invitedUser.uuid,
        workspaceId: workspace.id,
      });

      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);

      await service.removeWorkspaceInvite(notInvitedUser, invite.id);

      expect(workspaceRepository.deleteInviteBy).toHaveBeenCalledWith({
        id: invite.id,
      });
    });

    it('When user is invited user and tries to delete the invite, then it should success', async () => {
      const workspace = newWorkspace();
      const invite = newWorkspaceInvite({
        invitedUser: invitedUser.uuid,
        workspaceId: workspace.id,
      });

      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);

      await service.removeWorkspaceInvite(invitedUser, invite.id);

      expect(workspaceRepository.deleteInviteBy).toHaveBeenCalledWith({
        id: invite.id,
      });
    });
  });

  describe('changeUserRole', () => {
    it('When team does not exist, then error is thrown', async () => {
      jest.spyOn(teamRepository, 'getTeamById').mockResolvedValue(null);

      await expect(
        service.changeUserRole('workspaceId', 'teamId', 'userId', {
          role: WorkspaceRole.MEMBER,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user is not part of team, then error is thrown', async () => {
      jest
        .spyOn(teamRepository, 'getTeamById')
        .mockResolvedValue(newWorkspaceTeam());
      jest.spyOn(teamRepository, 'getTeamUser').mockResolvedValue(null);

      await expect(
        service.changeUserRole('workspaceId', 'teamId', 'userId', {
          role: WorkspaceRole.MEMBER,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user does not exist, then error is thrown', async () => {
      jest
        .spyOn(teamRepository, 'getTeamById')
        .mockResolvedValue(newWorkspaceTeam());
      jest.spyOn(teamRepository, 'getTeamUser').mockResolvedValue(
        new WorkspaceTeamUser({
          id: '',
          teamId: '',
          memberId: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(null);

      await expect(
        service.changeUserRole('workspaceId', 'teamId', 'userId', {
          role: WorkspaceRole.MEMBER,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('When a member of the team is upgrade to manager, then it works', async () => {
      const member = newUser();
      const team = newWorkspaceTeam();

      jest.spyOn(teamRepository, 'getTeamById').mockResolvedValue(team);
      jest.spyOn(teamRepository, 'getTeamUser').mockResolvedValue(
        new WorkspaceTeamUser({
          id: '',
          teamId: team.id,
          memberId: member.uuid,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(member);

      await service.changeUserRole('workspaceId', 'teamId', 'userId', {
        role: WorkspaceRole.MANAGER,
      });

      expect(teamRepository.updateById).toHaveBeenCalledWith(team.id, {
        managerId: member.uuid,
      });
    });

    it('When a team manager role is changed to member, then the owner is assigned as manager', async () => {
      const manager = newUser();
      const workspaceOwner = newUser();
      const team = newWorkspaceTeam({ manager: manager });
      const workspace = newWorkspace({ owner: workspaceOwner });

      jest.spyOn(teamRepository, 'getTeamById').mockResolvedValue(team);
      jest.spyOn(teamRepository, 'getTeamUser').mockResolvedValue(
        new WorkspaceTeamUser({
          id: '',
          teamId: team.id,
          memberId: manager.uuid,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(manager);
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);

      await service.changeUserRole('workspaceId', 'teamId', 'userId', {
        role: WorkspaceRole.MEMBER,
      });

      expect(teamRepository.updateById).toHaveBeenCalledWith(team.id, {
        managerId: workspaceOwner.uuid,
      });
    });

    it('When user is already manager and tries to update their role to manager, then it does nothing ', async () => {
      const manager = newUser();
      const workspaceOwner = newUser();
      const team = newWorkspaceTeam({ manager: manager });
      const workspace = newWorkspace({ owner: workspaceOwner });

      jest.spyOn(teamRepository, 'getTeamById').mockResolvedValue(team);
      jest.spyOn(teamRepository, 'getTeamUser').mockResolvedValue(
        new WorkspaceTeamUser({
          id: '',
          teamId: team.id,
          memberId: manager.uuid,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(manager);
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);

      await service.changeUserRole('workspaceId', 'teamId', 'userId', {
        role: WorkspaceRole.MANAGER,
      });

      expect(teamRepository.updateById).not.toHaveBeenCalled();
    });

    it('When user is already member and tries to update their role to member, then it does nothing', async () => {
      const member = newUser();
      const team = newWorkspaceTeam();

      jest.spyOn(teamRepository, 'getTeamById').mockResolvedValue(team);
      jest.spyOn(teamRepository, 'getTeamUser').mockResolvedValue(
        new WorkspaceTeamUser({
          id: '',
          teamId: team.id,
          memberId: member.uuid,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(member);

      await service.changeUserRole('workspaceId', 'teamId', 'userId', {
        role: WorkspaceRole.MEMBER,
      });

      expect(teamRepository.updateById).not.toHaveBeenCalled();
    });
  });

  describe('getAssignableSpaceInWorkspace', () => {
    const workspace = newWorkspace();
    const workspaceDefaultUser = newUser();
    it('When there is space left, then it should return the correct space left', async () => {
      jest.spyOn(networkService, 'getLimit').mockResolvedValue(1000000);
      jest
        .spyOn(workspaceRepository, 'getTotalSpaceLimitInWorkspaceUsers')
        .mockResolvedValue(BigInt(500000));
      jest
        .spyOn(workspaceRepository, 'getSpaceLimitInInvitations')
        .mockResolvedValue(BigInt(200000));

      const assignableSpace = await service.getAssignableSpaceInWorkspace(
        workspace,
        workspaceDefaultUser,
      );
      expect(assignableSpace).toBe(BigInt(300000));
    });
  });

  describe('getWorkspaceMembers', () => {
    const owner = newUser();
    const workspace = newWorkspace({ owner });

    it('When workspaceId does not exist then it should throw an error', async () => {
      const workspaceId = 'not-exist-uuid';
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.getWorkspaceMembers(workspaceId, owner),
      ).rejects.toThrow();
    });

    it('When there are no members then return an object with empty data', async () => {
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsers')
        .mockResolvedValue([]);

      await expect(
        service.getWorkspaceMembers(workspace.id, owner),
      ).resolves.toStrictEqual({
        activatedUsers: [],
        disabledUsers: [],
      });
    });

    it('When a user is registered as member and is not the owner then the "isOwner" field will be False', async () => {
      const user = newUser();
      const workspaceUserOwner = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: owner.uuid,
        member: owner,
        attributes: { deactivated: false },
      });
      const workspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user.uuid,
        member: user,
        attributes: { deactivated: false },
      });

      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsers')
        .mockResolvedValue([workspaceUserOwner, workspaceUser]);

      await expect(
        service.getWorkspaceMembers(workspace.id, owner),
      ).resolves.toMatchObject({
        activatedUsers: [
          {
            isOwner: true,
          },
          {
            isOwner: false,
          },
        ],
        disabledUsers: [],
      });
    });

    it('When a user is registered as owner of the workspace then the "isOwner" field will be True', async () => {
      const workspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: owner.uuid,
        member: owner,
        attributes: { deactivated: false },
      });

      const workspaceTeam = newWorkspaceTeam({
        workspaceId: workspace.id,
        manager: owner,
        mainTeam: true,
      });

      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsers')
        .mockResolvedValue([workspaceUser]);

      jest
        .spyOn(teamRepository, 'getTeamsInWorkspace')
        .mockResolvedValue([workspaceTeam]);

      const fnGetMembers = await service.getWorkspaceMembers(
        workspace.id,
        owner,
      );
      expect(fnGetMembers).toMatchObject({
        activatedUsers: [
          {
            isOwner: true,
            memberId: workspace.ownerId,
          },
        ],
        disabledUsers: [],
      });
    });

    it('When a user is not registered as Manager within a team then the "isManager" field will be False', async () => {
      const user = newUser();
      const workspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user.uuid,
        member: user,
        attributes: { deactivated: false },
      });

      const workspaceTeam = newWorkspaceTeam({
        workspaceId: workspace.id,
      });

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsers')
        .mockResolvedValue([workspaceUser]);

      jest
        .spyOn(teamRepository, 'getTeamsInWorkspace')
        .mockResolvedValue([workspaceTeam]);

      const mockWorkspaceUsers = {
        activatedUsers: [
          {
            ...workspaceUser.toJSON(),
            isOwner: false,
            isManager: false,
            freeSpace: workspaceUser.getFreeSpace().toString(),
            usedSpace: workspaceUser.getUsedSpace().toString(),
          },
        ],
        disabledUsers: [],
      };

      const fnGetMembers = await service.getWorkspaceMembers(
        workspace.id,
        owner,
      );

      expect(fnGetMembers).toStrictEqual(mockWorkspaceUsers);
      expect(fnGetMembers).toMatchObject({
        activatedUsers: [{ isManager: false }],
        disabledUsers: [],
      });
    });

    it('When a user is registered as Manager within a team then the "isManager" field will be True', async () => {
      const user1 = newUser();
      const user2 = newUser();

      const workspaceUser1 = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user1.uuid,
        member: user1,
        attributes: { deactivated: false },
      });
      const workspaceUser2 = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user2.uuid,
        member: user2,
        attributes: { deactivated: false },
      });

      const workspaceTeam = newWorkspaceTeam({
        workspaceId: workspace.id,
        manager: user1,
      });

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsers')
        .mockResolvedValue([workspaceUser1, workspaceUser2]);

      jest
        .spyOn(teamRepository, 'getTeamsInWorkspace')
        .mockResolvedValue([workspaceTeam]);

      const workspaceMembers = {
        activatedUsers: [
          {
            ...workspaceUser1.toJSON(),
            isOwner: false,
            isManager: true,
            freeSpace: workspaceUser1.getFreeSpace().toString(),
            usedSpace: workspaceUser1.getUsedSpace().toString(),
          },
          {
            ...workspaceUser2.toJSON(),
            isOwner: false,
            isManager: false,
            freeSpace: workspaceUser2.getFreeSpace().toString(),
            usedSpace: workspaceUser2.getUsedSpace().toString(),
          },
        ],
        disabledUsers: [],
      };

      const getMembers = await service.getWorkspaceMembers(workspace.id, owner);

      expect(getMembers).toStrictEqual(workspaceMembers);
      expect(getMembers).toMatchObject({
        activatedUsers: [{ isManager: true }, { isManager: false }],
        disabledUsers: [],
      });
    });
  });

  describe('createFolder', () => {
    const createFolderDto: CreateWorkspaceFolderDto = {
      name: 'New Folder',
      parentFolderUuid: v4(),
    };

    it('When parent folder is not found, then throw', async () => {
      const user = newUser();
      const nonExistentWorkspaceId = v4();
      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValue(null);

      await expect(
        service.createFolder(user, nonExistentWorkspaceId, createFolderDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('When user is not owner of parent folder, then it should throw', async () => {
      const user = newUser();
      const workspace = newWorkspace();
      const folderItem = newWorkspaceItemUser();

      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValue(folderItem);

      await expect(
        service.createFolder(user, workspace.id, createFolderDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When user tries to create folder in workspace root folder, then it should throw', async () => {
      const user = newUser();
      const parentFolderItem = newWorkspaceItemUser({ createdBy: user.uuid });
      const workspace = newWorkspace({
        attributes: { rootFolderId: createFolderDto.parentFolderUuid },
      });

      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValue(parentFolderItem);

      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);

      await expect(
        service.createFolder(user, workspace.id, createFolderDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When user has access to parent folder and it is not workspace root folder, then it should create folder successfully', async () => {
      const user = newUser();
      const networkUser = newUser();
      const workspace = newWorkspace();
      const parentFolderItem = newWorkspaceItemUser({ createdBy: user.uuid });
      const createdFolder = newFolder({
        owner: user,
      });
      const createdItemFolder = newWorkspaceItemUser({
        createdBy: user.uuid,
        itemType: WorkspaceItemType.Folder,
      });

      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValue(parentFolderItem);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(networkUser);
      jest
        .spyOn(folderUseCases, 'createFolder')
        .mockResolvedValue(createdFolder);
      jest
        .spyOn(workspaceRepository, 'createItem')
        .mockResolvedValue(createdItemFolder);

      const result = await service.createFolder(
        user,
        workspace.id,
        createFolderDto,
      );

      expect(result).toEqual({ ...createdFolder, item: createdItemFolder });
    });
  });

  describe('createFile', () => {
    const workspace = newWorkspace();
    const createFileDto: CreateWorkspaceFileDto = {
      name: 'New File',
      bucket: 'bucket-id',
      fileId: 'file-id',
      encryptVersion: 'v1',
      folderUuid: 'folder-uuid',
      size: BigInt(1024),
      plainName: 'plain-name',
      type: 'text/plain',
      modificationTime: new Date(),
      date: new Date(),
    };

    it('When users do not have space, then it should throw', async () => {
      const user = newUser();
      const workspaceUserWithNoSpace = newWorkspaceUser({
        attributes: { spaceLimit: BigInt(1024), driveUsage: BigInt(1024) },
      });

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(workspaceUserWithNoSpace);

      await expect(
        service.createFile(user, workspace.id, createFileDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('When file size is bigger than free space, then it should throw', async () => {
      const user = newUser();
      const size = BigInt(2000);
      const workspaceUserWithNoSpace = newWorkspaceUser({
        attributes: { spaceLimit: BigInt(1024), driveUsage: BigInt(1024) },
      });

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(workspaceUserWithNoSpace);

      await expect(
        service.createFile(user, workspace.id, { ...createFileDto, size }),
      ).rejects.toThrow(BadRequestException);
    });

    it('When parent folder is not valid, then it should throw', async () => {
      const user = newUser();
      const size = BigInt(2000);
      const workspaceUser = newWorkspaceUser({
        attributes: { spaceLimit: BigInt(2048), driveUsage: BigInt(1024) },
      });

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(workspaceUser);
      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValue(null);

      await expect(
        service.createFile(user, workspace.id, { ...createFileDto, size }),
      ).rejects.toThrow(BadRequestException);
    });

    it('When user does not own the parent folder, then it should throw', async () => {
      const user = newUser();
      const fileSize = BigInt(1000);
      const workspaceUser = newWorkspaceUser({
        attributes: { spaceLimit: fileSize + BigInt(1) },
      });
      const folderItem = newWorkspaceItemUser();

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(workspaceUser);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValue(folderItem);

      await expect(
        service.createFile(user, workspace.id, {
          ...createFileDto,
          size: fileSize,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When parent folder is the workspace root folder, then it should throw', async () => {
      const user = newUser();
      const fileSize = BigInt(2000);
      const workspace = newWorkspace({
        attributes: { rootFolderId: createFileDto.folderUuid },
      });
      const workspaceUser = newWorkspaceUser({
        attributes: {
          spaceLimit: fileSize + BigInt(1),
          rootFolderId: createFileDto.folderUuid,
        },
        workspaceId: workspace.id,
        member: user,
      });
      const folderItem = newWorkspaceItemUser({ createdBy: user.uuid });

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(workspaceUser);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValue(folderItem);
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);

      await expect(
        service.createFile(user, workspace.id, {
          ...createFileDto,
          size: fileSize,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When workspace user has enough space and parent folder is valid, then it should create file successfully', async () => {
      const user = newUser();
      const fileSize = BigInt(2000);
      const workspace = newWorkspace();
      const workspaceUser = newWorkspaceUser({
        attributes: {
          spaceLimit: fileSize + BigInt(1),
          rootFolderId: createFileDto.folderUuid,
        },
        workspaceId: workspace.id,
        member: user,
      });
      const folderItem = newWorkspaceItemUser({ createdBy: user.uuid });
      const createdFile = newFile({ owner: user });
      const createdItemFile = newWorkspaceItemUser({
        createdBy: user.uuid,
        itemType: WorkspaceItemType.File,
      });

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(workspaceUser);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValue(folderItem);
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(user);
      jest.spyOn(fileUseCases, 'createFile').mockResolvedValue(createdFile);
      jest
        .spyOn(workspaceRepository, 'createItem')
        .mockResolvedValue(createdItemFile);

      const result = await service.createFile(user, workspace.id, {
        ...createFileDto,
        size: fileSize,
      });

      expect(result).toEqual({ ...createdFile, item: createdItemFile });
    });
  });

  describe('getPersonalWorkspaceFoldersInFolder', () => {
    const user = newUser();
    const workspace = newWorkspace();
    const limit = 50;
    const offset = 0;
    const sort = 'name';
    const order = 'asc';

    it('When folder does not exist, then it should throw', async () => {
      const nonExistenFolderUuid = v4();
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(null);

      await expect(
        service.getPersonalWorkspaceFoldersInFolder(
          user,
          workspace.id,
          nonExistenFolderUuid,
          limit,
          offset,
          { sort, order },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When folder is not in workspace, then it should throw', async () => {
      const folder = newFolder();
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValueOnce(null);

      await expect(
        service.getPersonalWorkspaceFoldersInFolder(
          user,
          workspace.id,
          folder.uuid,
          limit,
          offset,
          { sort, order },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When user does not own folder, then it should throw', async () => {
      const folder = newFolder();
      const folderItem = newWorkspaceItemUser({ createdBy: 'notUser' });

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValueOnce(folderItem);

      await expect(
        service.getPersonalWorkspaceFoldersInFolder(
          user,
          workspace.id,
          folder.uuid,
          limit,
          offset,
          { sort, order },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When user has access to folder, then it should return folders in that folder', async () => {
      const folder = newFolder();
      const item = newWorkspaceItemUser({ createdBy: user.uuid });
      const childFolder = newFolder({ attributes: { parentId: folder.id } });

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValueOnce(item);
      jest
        .spyOn(folderUseCases, 'getFoldersWithParentInWorkspace')
        .mockResolvedValueOnce([childFolder]);

      const result = await service.getPersonalWorkspaceFoldersInFolder(
        user,
        workspace.id,
        folder.uuid,
        limit,
        offset,
        { sort, order },
      );

      expect(result).toEqual({
        result: [
          {
            ...childFolder,
            status: FileStatus.EXISTS,
          },
        ],
      });
    });
  });

  describe('getMemberDetails', () => {
    it('When user is not found, then it should throw', async () => {
      const workspace = newWorkspace();

      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(null);

      await expect(
        service.getMemberDetails(workspace.id, 'memberId'),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user is not part of workspace, then it should throw', async () => {
      const userNotMember = newUser();
      const workspace = newWorkspace();

      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(userNotMember);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(null);

      await expect(
        service.getMemberDetails(workspace.id, userNotMember.uuid),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user and workspace are valid and user is part of workspace, then it should return the member data', async () => {
      const managerUser = newUser();
      const workspace = newWorkspace();
      const workspaceUser = newWorkspaceUser({ workspaceId: workspace.id });
      const team = newWorkspaceTeam({
        workspaceId: workspace.id,
        manager: managerUser,
      });
      const teamUser = newWorkspaceTeamUser({
        teamId: team.id,
        memberId: managerUser.uuid,
      });

      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(managerUser);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(workspaceUser);
      jest
        .spyOn(teamRepository, 'getTeamAndMemberByWorkspaceAndMemberId')
        .mockResolvedValue([{ team, teamUser }]);

      const memberDetails = await service.getMemberDetails(
        workspace.id,
        managerUser.uuid,
      );

      expect(memberDetails).toMatchObject({
        user: {
          name: managerUser.name,
          lastname: managerUser.lastname,
          email: managerUser.email,
          uuid: managerUser.uuid,
          id: managerUser.id,
          avatar: null,
          memberId: workspaceUser.memberId,
          workspaceId: workspaceUser.workspaceId,
          spaceLimit: workspaceUser.spaceLimit.toString(),
          driveUsage: workspaceUser.driveUsage.toString(),
          backupsUsage: workspaceUser.backupsUsage.toString(),
          deactivated: workspaceUser.deactivated,
        },
        teams: [{ ...team, isManager: team.isUserManager(managerUser) }],
      });
    });
  });

  describe('getPersonalWorkspaceFilesInFolder', () => {
    const user = newUser();
    const workspace = newWorkspace();
    const folder = newFolder();
    const limit = 50;
    const offset = 0;
    const sort = 'name';
    const order = 'asc';

    it('When parent folder does not exist, then it should throw', async () => {
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(null);

      await expect(
        service.getPersonalWorkspaceFilesInFolder(
          user,
          workspace.id,
          folder.uuid,
          limit,
          offset,
          { sort, order },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When folder is not in workspace, then it should throw', async () => {
      const folder = newFolder();
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValueOnce(null);

      await expect(
        service.getPersonalWorkspaceFilesInFolder(
          user,
          workspace.id,
          folder.uuid,
          limit,
          offset,
          { sort, order },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When folder item is not owned by user, then it should throw', async () => {
      const folder = newFolder();
      const folderItem = newWorkspaceItemUser({ createdBy: 'notUser' });

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValueOnce(folderItem);

      await expect(
        service.getPersonalWorkspaceFilesInFolder(
          user,
          workspace.id,
          folder.uuid,
          limit,
          offset,
          { sort, order },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When user has access to folder, then it should return files in that folder', async () => {
      const folder = newFolder();
      const item = newWorkspaceItemUser({ createdBy: user.uuid });
      const file = newFile({ folder });

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValueOnce(item);
      jest
        .spyOn(fileUseCases, 'getFilesInWorkspace')
        .mockResolvedValueOnce([file]);

      const result = await service.getPersonalWorkspaceFilesInFolder(
        user,
        workspace.id,
        folder.uuid,
        limit,
        offset,
        { sort, order },
      );

      expect(result).toEqual({
        result: [file],
      });
    });

    it('When folder is empty, then it should return an empty array', async () => {
      const folder = newFolder();
      const item = newWorkspaceItemUser({ createdBy: user.uuid });

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(folder);
      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValueOnce(item);
      jest.spyOn(fileUseCases, 'getFilesInWorkspace').mockResolvedValueOnce([]);

      const result = await service.getPersonalWorkspaceFilesInFolder(
        user,
        workspace.id,
        folder.uuid,
        limit,
        offset,
        { sort, order },
      );

      expect(result).toEqual({
        result: [],
      });
    });
  });

  describe('initiateWorkspace', () => {
    const owner = newUser();
    const maxSpaceBytes = 1000000;
    const workspaceData = { address: '123 Main St' };

    it('When owner does not exist, then it should throw', async () => {
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(null);

      await expect(
        service.initiateWorkspace(owner.uuid, maxSpaceBytes, workspaceData),
      ).rejects.toThrow(BadRequestException);
    });

    it('When workspace, default team and root folder are successfully created, then it should return the new workspace', async () => {
      const owner = newUser();
      const networkUser = { userId: 'networkUserId', uuid: v4() };
      const workspaceUser = newUser();
      const newDefaultTeam = newWorkspaceTeam();
      const createdWorkspace = newWorkspace({
        owner,
        attributes: {
          defaultTeamId: newDefaultTeam.id,
          address: workspaceData.address,
        },
      });
      const createdRootFolder = newFolder({ owner: workspaceUser });
      const bucket = {
        user: networkUser.userId,
        encryptionKey: 'encryption-key',
        publicPermissions: ['read', 'write'],
        created: 'date',
        maxFrameSize: 1000,
        name: 'bucket-name',
        pubkeys: ['pubkey1', 'pubkey2'],
        transfer: 1000,
        storage: 1000,
        id: 'bucket-id',
      };

      jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(owner);
      jest
        .spyOn(networkService, 'createUser')
        .mockResolvedValueOnce(networkUser);
      jest.spyOn(networkService, 'setStorage').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'create').mockResolvedValueOnce(workspaceUser);
      jest.spyOn(networkService, 'createBucket').mockResolvedValueOnce(bucket);
      jest
        .spyOn(folderUseCases, 'createRootFolder')
        .mockResolvedValueOnce(createdRootFolder);
      jest.spyOn(userRepository, 'updateBy').mockResolvedValueOnce(undefined);
      jest
        .spyOn(teamRepository, 'createTeam')
        .mockResolvedValueOnce(newDefaultTeam);
      jest
        .spyOn(workspaceRepository, 'create')
        .mockResolvedValueOnce(createdWorkspace);

      const result = await service.initiateWorkspace(
        owner.uuid,
        maxSpaceBytes,
        workspaceData,
      );

      expect(result).toEqual({
        workspace: expect.objectContaining({
          address: workspaceData.address,
          name: 'My Workspace',
          ownerId: owner.uuid,
          rootFolderId: createdRootFolder.uuid,
          workspaceUserId: workspaceUser.uuid,
        }),
      });
      expect(folderUseCases.createRootFolder).toHaveBeenCalledWith(
        workspaceUser,
        expect.any(String),
        bucket.id,
      );
      expect(workspaceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: owner.uuid }),
      );
    });

    describe('getTeamMembers', () => {
      it('When members are found, then it should return members data', async () => {
        const member1 = newUser({
          attributes: { avatar: v4() },
        });
        const member2 = newUser();
        const avatarUrl = 'avatarUrl';
        jest
          .spyOn(teamRepository, 'getTeamMembers')
          .mockResolvedValue([member1, member2]);
        jest.spyOn(userUsecases, 'getAvatarUrl').mockResolvedValue(avatarUrl);

        const result = await service.getTeamMembers(v4());

        expect(result).toEqual([
          {
            name: member1.name,
            lastname: member1.lastname,
            email: member1.email,
            id: member1.id,
            uuid: member1.uuid,
            avatar: avatarUrl,
          },
          {
            name: member2.name,
            lastname: member2.lastname,
            email: member2.email,
            id: member2.id,
            uuid: member2.uuid,
            avatar: null,
          },
        ]);
      });

      it('When members are not found, then it should return empty', async () => {
        jest.spyOn(teamRepository, 'getTeamMembers').mockResolvedValue([]);

        const result = await service.getTeamMembers(v4());

        expect(result).toEqual([]);
      });
    });

    describe('deactivateWorkspaceUser', () => {
      it('When user is not valid or it is not part of workspace, then it should throw', async () => {
        jest
          .spyOn(workspaceRepository, 'findWorkspaceAndUser')
          .mockResolvedValue({ workspace: null, workspaceUser: null });

        await expect(
          service.deactivateWorkspaceUser(newUser(), 'workspaceId', 'memberId'),
        ).rejects.toThrow(BadRequestException);
      });

      it('When user is owner of workspace, then it should throw', async () => {
        const owner = newUser();
        const workspace = newWorkspace({ owner });
        const workspaceUser = newWorkspaceUser({
          workspaceId: workspace.id,
          memberId: owner.uuid,
        });

        jest
          .spyOn(workspaceRepository, 'findWorkspaceAndUser')
          .mockResolvedValue({ workspace, workspaceUser });

        await expect(
          service.deactivateWorkspaceUser(owner, 'workspaceId', 'memberId'),
        ).rejects.toThrow(BadRequestException);
      });

      it('When user is valid, then it is deactivated', async () => {
        const member = newUser();
        const workspace = newWorkspace();
        const workspaceUser = newWorkspaceUser({
          workspaceId: workspace.id,
          memberId: member.uuid,
        });

        jest
          .spyOn(workspaceRepository, 'findWorkspaceAndUser')
          .mockResolvedValue({ workspace, workspaceUser });

        await service.deactivateWorkspaceUser(
          member,
          'workspaceId',
          'memberId',
        );

        expect(
          workspaceRepository.deactivateWorkspaceUser,
        ).toHaveBeenCalledWith(member.uuid, workspace.id);
      });
    });

    describe('teams', () => {
      describe('createTeam', () => {
        it('When workspace is not found, then fail', async () => {
          const user = newUser();
          const workspace = newWorkspace({ owner: user });

          jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(null);
          await expect(
            service.createTeam(user, workspace.id, {
              name: 'test',
              managerId: '',
            }),
          ).rejects.toThrow(BadRequestException);
        });

        it('When maximum teams in a workspace is reached, then throw', async () => {
          const user = newUser();
          const workspace = newWorkspace({ owner: user });

          jest
            .spyOn(workspaceRepository, 'findOne')
            .mockResolvedValue(workspace);
          jest
            .spyOn(teamRepository, 'getTeamsInWorkspaceCount')
            .mockResolvedValue(10);

          await expect(
            service.createTeam(user, workspace.id, {
              name: 'test',
              managerId: '',
            }),
          ).rejects.toThrow(BadRequestException);
        });

        it('When the manager does not belongs to the workspace is reached, then throw', async () => {
          const owner = newUser();
          const user = newUser();
          const workspace = newWorkspace({ owner: owner });

          jest
            .spyOn(workspaceRepository, 'findOne')
            .mockResolvedValue(workspace);
          jest
            .spyOn(teamRepository, 'getTeamsInWorkspaceCount')
            .mockResolvedValue(1);
          jest
            .spyOn(workspaceRepository, 'findWorkspaceUser')
            .mockResolvedValue(null);

          await expect(
            service.createTeam(owner, workspace.id, {
              name: 'test-create-team',
              managerId: user.uuid,
            }),
          ).rejects.toThrow(BadRequestException);
        });

        it('When maximum teams in a workspace is still not reached, then team is created succesfully', async () => {
          const user = newUser();
          const workspace = newWorkspace({ owner: user });
          const createdTeam = newWorkspaceTeam({
            workspaceId: workspace.id,
            manager: user,
          });
          const teamInput = {
            name: 'test',
          };

          jest
            .spyOn(workspaceRepository, 'findOne')
            .mockResolvedValue(workspace);
          jest
            .spyOn(teamRepository, 'getTeamsInWorkspaceCount')
            .mockResolvedValue(5);
          jest
            .spyOn(teamRepository, 'createTeam')
            .mockResolvedValue(createdTeam);

          const newTeam = await service.createTeam(
            user,
            workspace.id,
            teamInput,
          );

          expect(teamRepository.createTeam).toHaveBeenCalledWith(
            expect.objectContaining({
              workspaceId: workspace.id,
              name: teamInput.name,
              managerId: user.uuid,
            }),
          );

          expect(newTeam).toEqual(createdTeam);
        });
      });

      describe('getAndValidateNonDefaultTeamWorkspace', () => {
        it('When team is not found, then it should throw', async () => {
          const teamId = 'team-id';

          jest.spyOn(teamRepository, 'getTeamById').mockResolvedValue(null);

          await expect(
            service.getAndValidateNonDefaultTeamWorkspace(teamId),
          ).rejects.toThrow(BadRequestException);
        });

        it('When team is the default one of the workspace, then it should throw', async () => {
          const workspace = newWorkspace();
          const team = newWorkspaceTeam({ workspaceId: workspace.id });
          workspace.defaultTeamId = team.id;

          jest.spyOn(teamRepository, 'getTeamById').mockResolvedValue(team);
          jest
            .spyOn(workspaceRepository, 'findOne')
            .mockResolvedValue(workspace);

          await expect(
            service.getAndValidateNonDefaultTeamWorkspace(team.id),
          ).rejects.toThrow(BadRequestException);
        });

        it('When workspace is not found, then it should throw', async () => {
          const team = newWorkspaceTeam();

          jest.spyOn(teamRepository, 'getTeamById').mockResolvedValue(team);
          jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(null);

          await expect(
            service.getAndValidateNonDefaultTeamWorkspace(team.id),
          ).rejects.toThrow(ForbiddenException);
        });

        it('When team and workspace are valid, then return', async () => {
          const workspace = newWorkspace();
          const team = newWorkspaceTeam({ workspaceId: workspace.id });

          jest.spyOn(teamRepository, 'getTeamById').mockResolvedValue(team);
          jest
            .spyOn(workspaceRepository, 'findOne')
            .mockResolvedValue(workspace);
          const result = await service.getAndValidateNonDefaultTeamWorkspace(
            team.id,
          );

          expect(result.team).toEqual(team);
          expect(result.workspace).toEqual(workspace);
        });
      });

      describe('editTeamData', () => {
        it('When the team is part of the workspace and is not the default team of the workspace, then the update is done', async () => {
          const user = newUser();
          const workspace = newWorkspace({ owner: user });
          const team = newWorkspaceTeam({
            workspaceId: workspace.id,
            manager: user,
          });
          const editTeamDto = { name: 'Updated Team' };

          jest
            .spyOn(service, 'getAndValidateNonDefaultTeamWorkspace')
            .mockResolvedValueOnce({ team, workspace });

          await service.editTeamData(team.id, editTeamDto);

          expect(teamRepository.updateById).toHaveBeenCalledWith(
            team.id,
            editTeamDto,
          );
        });
      });

      describe('addMemberToTeam', () => {
        it('When team is not valid or is the default team of the workspace, then it should throw', async () => {
          const teamId = 'team-id';
          const memberId = 'member-uuid';

          jest
            .spyOn(service, 'getAndValidateNonDefaultTeamWorkspace')
            .mockRejectedValueOnce(new BadRequestException());

          await expect(
            service.addMemberToTeam(teamId, memberId),
          ).rejects.toThrow(BadRequestException);
        });

        it('When user is not part of workspace, then it should throw', async () => {
          const user = newUser();
          const workspace = newWorkspace();
          const team = newWorkspaceTeam({
            workspaceId: workspace.id,
          });

          jest
            .spyOn(service, 'getAndValidateNonDefaultTeamWorkspace')
            .mockResolvedValueOnce({ team, workspace });
          jest
            .spyOn(workspaceRepository, 'findWorkspaceUser')
            .mockResolvedValue(null);

          await expect(
            service.addMemberToTeam(team.id, user.uuid),
          ).rejects.toThrow(BadRequestException);
        });

        it('When user is already part of team, then it should throw', async () => {
          const user = newUser();
          const workspace = newWorkspace();
          const team = newWorkspaceTeam({
            workspaceId: workspace.id,
          });
          const workspaceUser = newWorkspaceUser({
            memberId: user.uuid,
            workspaceId: workspace.id,
          });
          const teamUser = newWorkspaceTeamUser({
            teamId: team.id,
            memberId: user.uuid,
          });

          jest
            .spyOn(service, 'getAndValidateNonDefaultTeamWorkspace')
            .mockResolvedValueOnce({ team, workspace });
          jest
            .spyOn(workspaceRepository, 'findWorkspaceUser')
            .mockResolvedValue(workspaceUser);
          jest.spyOn(teamRepository, 'getTeamUser').mockResolvedValue(teamUser);

          await expect(
            service.addMemberToTeam(team.id, user.uuid),
          ).rejects.toThrow(BadRequestException);
        });

        it('When member limit is reached, then it should throw', async () => {
          const user = newUser();
          const workspace = newWorkspace();
          const team = newWorkspaceTeam({
            workspaceId: workspace.id,
          });
          const workspaceUser = newWorkspaceUser({
            memberId: user.uuid,
            workspaceId: workspace.id,
          });

          jest
            .spyOn(service, 'getAndValidateNonDefaultTeamWorkspace')
            .mockResolvedValueOnce({ team, workspace });
          jest
            .spyOn(workspaceRepository, 'findWorkspaceUser')
            .mockResolvedValue(workspaceUser);
          jest.spyOn(teamRepository, 'getTeamUser').mockResolvedValue(null);
          jest
            .spyOn(teamRepository, 'getTeamMembersCount')
            .mockResolvedValue(20);

          await expect(
            service.addMemberToTeam(team.id, user.uuid),
          ).rejects.toThrow(BadRequestException);
        });

        it('When member is added successfully, then it should return the new member', async () => {
          const user = newUser();
          const workspace = newWorkspace();
          const team = newWorkspaceTeam({
            workspaceId: workspace.id,
          });
          const workspaceUser = newWorkspaceUser({
            memberId: user.uuid,
            workspaceId: workspace.id,
          });
          const teamUser = newWorkspaceTeamUser({
            teamId: team.id,
            memberId: user.uuid,
          });

          jest
            .spyOn(service, 'getAndValidateNonDefaultTeamWorkspace')
            .mockResolvedValueOnce({ team, workspace });
          jest
            .spyOn(workspaceRepository, 'findWorkspaceUser')
            .mockResolvedValue(workspaceUser);
          jest.spyOn(teamRepository, 'getTeamUser').mockResolvedValue(null);
          jest
            .spyOn(teamRepository, 'getTeamMembersCount')
            .mockResolvedValue(10);
          jest
            .spyOn(teamRepository, 'addUserToTeam')
            .mockResolvedValue(teamUser);

          const newMember = await service.addMemberToTeam(team.id, user.uuid);

          expect(newMember).toEqual(teamUser);
        });
      });

      describe('removeMemberFromTeam', () => {
        it('When team is not valid or is the default team of the workspace, then it should throw', async () => {
          const teamId = 'team-id';
          const memberId = 'member-uuid';

          jest
            .spyOn(service, 'getAndValidateNonDefaultTeamWorkspace')
            .mockRejectedValueOnce(new BadRequestException());

          await expect(
            service.removeMemberFromTeam(teamId, memberId),
          ).rejects.toThrow(BadRequestException);
        });

        it('When user is not part of team, then it should throw', async () => {
          const user = newUser();
          const workspace = newWorkspace();
          const team = newWorkspaceTeam({
            workspaceId: workspace.id,
          });

          jest
            .spyOn(service, 'getAndValidateNonDefaultTeamWorkspace')
            .mockResolvedValueOnce({ team, workspace });
          jest.spyOn(teamRepository, 'getTeamUser').mockResolvedValue(null);

          await expect(
            service.removeMemberFromTeam(team.id, user.uuid),
          ).rejects.toThrow(BadRequestException);
        });

        it('When user is the manager of the team, then owner of the workspace should be assigned as manager', async () => {
          const workspaceOwner = newUser();
          const workspace = newWorkspace({ owner: workspaceOwner });
          const manager = newUser();
          const team = newWorkspaceTeam({
            workspaceId: workspace.id,
            manager: manager,
          });
          const teamUser = newWorkspaceTeamUser({
            teamId: team.id,
            memberId: manager.uuid,
          });

          jest
            .spyOn(service, 'getAndValidateNonDefaultTeamWorkspace')
            .mockResolvedValueOnce({ team, workspace });
          jest.spyOn(teamRepository, 'getTeamUser').mockResolvedValue(teamUser);
          jest
            .spyOn(workspaceRepository, 'findOne')
            .mockResolvedValue(workspace);

          await service.removeMemberFromTeam(team.id, manager.uuid);

          expect(teamRepository.updateById).toHaveBeenCalledWith(team.id, {
            managerId: workspace.ownerId,
          });
        });

        it('When user is being removed, then it should resolve', async () => {
          const workspaceOwner = newUser();
          const workspace = newWorkspace({ owner: workspaceOwner });
          const member = newUser();
          const team = newWorkspaceTeam({
            workspaceId: workspace.id,
          });
          const teamUser = newWorkspaceTeamUser({
            teamId: team.id,
          });

          jest
            .spyOn(service, 'getAndValidateNonDefaultTeamWorkspace')
            .mockResolvedValueOnce({ team, workspace });
          jest.spyOn(teamRepository, 'getTeamUser').mockResolvedValue(teamUser);
          jest
            .spyOn(workspaceRepository, 'findOne')
            .mockResolvedValue(workspace);

          await service.removeMemberFromTeam(team.id, member.uuid);

          expect(teamRepository.removeMemberFromTeam).toHaveBeenCalledWith(
            team.id,
            member.uuid,
          );
        });
      });

      describe('changeTeamManager', () => {
        it('When team is not valid or is the default team of the workspace, then it should throw', async () => {
          const teamId = 'team-id';
          const memberId = 'member-uuid';

          jest
            .spyOn(service, 'getAndValidateNonDefaultTeamWorkspace')
            .mockRejectedValueOnce(new BadRequestException());

          await expect(
            service.changeTeamManager(teamId, memberId),
          ).rejects.toThrow(BadRequestException);
        });

        it('When user is not part of workspace, then it should throw', async () => {
          const user = newUser();
          const workspace = newWorkspace();
          const team = newWorkspaceTeam({
            workspaceId: workspace.id,
          });

          jest.spyOn(teamRepository, 'getTeamById').mockResolvedValue(team);
          jest
            .spyOn(workspaceRepository, 'findOne')
            .mockResolvedValue(workspace);
          jest
            .spyOn(workspaceRepository, 'findWorkspaceUser')
            .mockResolvedValue(null);

          await expect(
            service.changeTeamManager(team.id, user.uuid),
          ).rejects.toThrow(BadRequestException);
        });

        it('When user is not part of team, then it should throw', async () => {
          const user = newUser();
          const workspace = newWorkspace();
          const workspaceUser = newWorkspaceUser({ workspaceId: workspace.id });
          const team = newWorkspaceTeam({
            workspaceId: workspace.id,
          });

          jest.spyOn(teamRepository, 'getTeamById').mockResolvedValue(team);
          jest
            .spyOn(workspaceRepository, 'findOne')
            .mockResolvedValue(workspace);
          jest
            .spyOn(workspaceRepository, 'findWorkspaceUser')
            .mockResolvedValue(workspaceUser);
          jest.spyOn(teamRepository, 'getTeamUser').mockResolvedValue(null);

          await expect(
            service.changeTeamManager(team.id, user.uuid),
          ).rejects.toThrow(BadRequestException);
        });

        it('When user is being assigned succesfully, then it should resolve', async () => {
          const user = newUser();
          const workspace = newWorkspace();
          const workspaceUser = newWorkspaceUser({ workspaceId: workspace.id });
          const team = newWorkspaceTeam({
            workspaceId: workspace.id,
          });
          const teamUser = newWorkspaceTeamUser({
            teamId: team.id,
            memberId: user.uuid,
          });

          jest.spyOn(teamRepository, 'getTeamById').mockResolvedValue(team);
          jest
            .spyOn(workspaceRepository, 'findOne')
            .mockResolvedValue(workspace);
          jest
            .spyOn(workspaceRepository, 'findWorkspaceUser')
            .mockResolvedValue(workspaceUser);
          jest.spyOn(teamRepository, 'getTeamUser').mockResolvedValue(teamUser);

          await service.changeTeamManager(team.id, user.uuid);

          expect(teamRepository.updateById).toHaveBeenCalledWith(team.id, {
            managerId: user.uuid,
          });
        });
      });

      describe('deleteTeam', () => {
        it('When team is not valid or is the default team of the workspace, then it should throw', async () => {
          const teamId = 'team-id';

          jest
            .spyOn(service, 'getAndValidateNonDefaultTeamWorkspace')
            .mockRejectedValueOnce(new BadRequestException());

          await expect(service.deleteTeam(teamId)).rejects.toThrow(
            BadRequestException,
          );
        });

        it('When a team is deleted, then it should resolve', async () => {
          const workspace = newWorkspace();
          const team = newWorkspaceTeam({
            workspaceId: workspace.id,
          });

          jest.spyOn(teamRepository, 'getTeamById').mockResolvedValue(team);
          jest
            .spyOn(workspaceRepository, 'findOne')
            .mockResolvedValue(workspace);

          await service.deleteTeam(team.id);
          expect(teamRepository.deleteTeamById).toHaveBeenCalledWith(team.id);
        });
      });
    });

    describe('deleteWorkspaceContent', () => {
      it('When workspace is not found, then it should throw', async () => {
        const workspaceId = v4();
        const user = newUser();
        jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(null);

        await expect(
          service.deleteWorkspaceContent(workspaceId, user),
        ).rejects.toThrow(NotFoundException);
      });

      it('When user is not the owner of the workspace, then it should throw', async () => {
        const workspace = newWorkspace();
        const user = newUser();
        jest
          .spyOn(workspaceRepository, 'findById')
          .mockResolvedValue(workspace);

        await expect(
          service.deleteWorkspaceContent(workspace.id, user),
        ).rejects.toThrow(ForbiddenException);
      });

      it('When workspace is found and user is the owner, then it should delete all workspace content', async () => {
        const user = newUser();
        const workspace = newWorkspace({ attributes: { ownerId: user.uuid } });
        jest
          .spyOn(workspaceRepository, 'findById')
          .mockResolvedValue(workspace);

        await service.deleteWorkspaceContent(workspace.id, user);

        expect(workspaceRepository.deleteById).toHaveBeenCalledWith(
          workspace.id,
        );
      });
    });

    describe('leaveWorkspace', () => {
      it('When workspace is not found, then it should throw', async () => {
        const workspaceId = v4();
        const user = newUser();
        jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(null);

        await expect(service.leaveWorkspace(workspaceId, user)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('When user is not part of workspace, then it should throw', async () => {
        const workspace = newWorkspace();
        const user = newUser();
        jest
          .spyOn(workspaceRepository, 'findById')
          .mockResolvedValue(workspace);
        jest
          .spyOn(workspaceRepository, 'findWorkspaceUser')
          .mockResolvedValue(null);

        await expect(
          service.leaveWorkspace(workspace.id, user),
        ).rejects.toThrow(BadRequestException);
      });

      it('When user is the owner of the workspace, then it should throw', async () => {
        const user = newUser();
        const workspace = newWorkspace({ attributes: { ownerId: user.uuid } });
        jest
          .spyOn(workspaceRepository, 'findById')
          .mockResolvedValue(workspace);

        await expect(
          service.leaveWorkspace(workspace.id, user),
        ).rejects.toThrow(BadRequestException);
      });

      it('When user has items in the workspace, then it should throw', async () => {
        const user = newUser();
        const workspace = newWorkspace();
        const workspaceUser = newWorkspaceUser({
          memberId: user.uuid,
          workspaceId: workspace.id,
        });
        const itemUser = newWorkspaceItemUser({
          workspaceId: workspace.id,
          createdBy: user.uuid,
        });
        jest
          .spyOn(workspaceRepository, 'findById')
          .mockResolvedValue(workspace);
        jest
          .spyOn(workspaceRepository, 'findWorkspaceUser')
          .mockResolvedValue(workspaceUser);
        jest
          .spyOn(workspaceItemsUsersRepository, 'getAllByUserAndWorkspaceId')
          .mockResolvedValue([itemUser]);

        await expect(
          service.leaveWorkspace(workspace.id, user),
        ).rejects.toThrow(BadRequestException);
      });

      it('When the user is a manager, then the workspace owner is set as manager of those teams', async () => {
        const user = newUser();
        const workspaceOwner = newUser();
        const workspace = newWorkspace({ owner: workspaceOwner });
        const workspaceUser = newWorkspaceUser({
          memberId: user.uuid,
          workspaceId: workspace.id,
        });
        const team = newWorkspaceTeam({
          workspaceId: workspace.id,
          manager: user,
        });

        jest
          .spyOn(workspaceRepository, 'findById')
          .mockResolvedValue(workspace);
        jest
          .spyOn(workspaceRepository, 'findWorkspaceUser')
          .mockResolvedValue(workspaceUser);
        jest
          .spyOn(teamRepository, 'getTeamsWhereUserIsManagerByWorkspaceId')
          .mockResolvedValue([team]);

        await service.leaveWorkspace(workspace.id, user);

        expect(teamRepository.updateById).toHaveBeenCalledWith(team.id, {
          managerId: workspaceOwner.uuid,
        });

        expect(teamRepository.deleteUserFromTeam).toHaveBeenCalledWith(
          user.uuid,
          team.id,
        );

        expect(
          workspaceRepository.deleteUserFromWorkspace,
        ).toHaveBeenCalledWith(user.uuid, workspace.id);
      });
    });

    it('When user is not a manager of any teams and has no items in the workspace, then they should leave the workspace', async () => {
      const user = newUser();
      const workspace = newWorkspace();
      const workspaceUser = newWorkspaceUser({
        memberId: user.uuid,
        workspaceId: workspace.id,
      });

      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(workspaceUser);
      jest
        .spyOn(workspaceItemsUsersRepository, 'getAllByUserAndWorkspaceId')
        .mockResolvedValue([]);

      await service.leaveWorkspace(workspace.id, user);

      expect(workspaceRepository.deleteUserFromWorkspace).toHaveBeenCalledWith(
        user.uuid,
        workspace.id,
      );
    });
  });
});
