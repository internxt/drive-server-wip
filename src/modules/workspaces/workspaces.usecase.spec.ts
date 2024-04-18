import { Test, TestingModule } from '@nestjs/testing';
import { SequelizeWorkspaceRepository } from './repositories/workspaces.repository';
import { SequelizeUserRepository } from '../user/user.repository';
import { UserUseCases } from '../user/user.usecase';
import { MailerService } from '../../externals/mailer/mailer.service';
import { ConfigService } from '@nestjs/config';
import { createMock } from '@golevelup/ts-jest';
import { WorkspacesUsecases } from './workspaces.usecase';
import {
  newUser,
  newWorkspace,
  newWorkspaceInvite,
  newWorkspaceTeam,
  newWorkspaceUser,
} from '../../../test/fixtures';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PreCreatedUser } from '../user/pre-created-user.domain';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { SequelizeWorkspaceTeamRepository } from './repositories/team.repository';
import { WorkspaceRole } from './guards/workspace-required-access.decorator';
import { WorkspaceTeamUser } from './domains/workspace-team-user.domain';

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
    it('When trying to get user available workspaces, then workspaces that are already setup should be returned', async () => {
      const user = newUser();
      const workspace = newWorkspace({
        attributes: { setupCompleted: true },
      });
      const workspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user.uuid,
        attributes: { deactivated: false },
      });

      jest
        .spyOn(workspaceRepository, 'findUserAvailableWorkspaces')
        .mockResolvedValue([{ workspaceUser, workspace }]);
      const availablesWorkspaces = await service.getAvailableWorkspaces(user);

      expect(availablesWorkspaces[0]).toEqual({
        workspaceUser,
        workspace,
      });
    });

    it('When trying to get user available workspaces, then workspaces that are not setup should not be returned', async () => {
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
        .spyOn(workspaceRepository, 'findUserAvailableWorkspaces')
        .mockResolvedValue([{ workspaceUser, workspace }]);
      const availablesWorkspaces = await service.getAvailableWorkspaces(user);

      expect(availablesWorkspaces).toEqual([]);
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
        .spyOn(workspaceRepository, 'findUserAvailableWorkspaces')
        .mockResolvedValue([{ workspaceUser, workspace }]);
      const availablesWorkspaces = await service.getAvailableWorkspaces(user);

      expect(availablesWorkspaces).toEqual([]);
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
});
