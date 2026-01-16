import { Test, TestingModule } from '@nestjs/testing';
import { SequelizeWorkspaceRepository } from './repositories/workspaces.repository';
import { SequelizeUserRepository } from '../user/user.repository';
import { UserUseCases } from '../user/user.usecase';
import { AvatarService } from '../../externals/avatar/avatar.service';
import { MailerService } from '../../externals/mailer/mailer.service';
import { ConfigService } from '@nestjs/config';
import { createMock } from '@golevelup/ts-jest';
import { WorkspacesUsecases } from './workspaces.usecase';
import {
  newFile,
  newFolder,
  newPreCreatedUser,
  newRole,
  newSharing,
  newSharingRole,
  newTier,
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
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PreCreatedUser } from '../user/pre-created-user.domain';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { SequelizeWorkspaceTeamRepository } from './repositories/team.repository';
import { WorkspaceRole } from './guards/workspace-required-access.decorator';
import { WorkspaceTeamUser } from './domains/workspace-team-user.domain';
import { EditWorkspaceDetailsDto } from './dto/edit-workspace-details-dto';
import { FolderUseCases } from '../folder/folder.usecase';
import { CreateWorkspaceFolderDto } from './dto/create-workspace-folder.dto';
import { WorkspaceItemType } from './attributes/workspace-items-users.attributes';
import { FileUseCases } from '../file/file.usecase';
import { CreateWorkspaceFileDto } from './dto/create-workspace-file.dto';
import { FileStatus } from '../file/file.domain';
import { v4 } from 'uuid';
import { SharingService } from '../sharing/sharing.service';
import {
  generateTokenWithPlainSecret,
  verifyWithDefaultSecret,
} from '../../lib/jwt';
import { Role, SharedWithType } from '../sharing/sharing.domain';
import { WorkspaceAttributes } from './attributes/workspace.attributes';
import * as jwtUtils from '../../lib/jwt';
import { PaymentsService } from '../../externals/payments/payments.service';
import {
  FileWithSharedInfo,
  FolderWithSharedInfo,
} from '../sharing/dto/get-items-and-shared-folders.dto';
import { FuzzySearchUseCases } from '../fuzzy-search/fuzzy-search.usecase';
import { FuzzySearchResult } from '../fuzzy-search/dto/fuzzy-search-result.dto';
import { FolderStatus } from '../folder/folder.domain';
import { WorkspaceLog } from './domains/workspace-log.domain';
import {
  WorkspaceLogPlatform,
  WorkspaceLogType,
} from './attributes/workspace-logs.attributes';

jest.mock('../../middlewares/passport', () => {
  const originalModule = jest.requireActual('../../middlewares/passport');
  return {
    __esModule: true,
    ...originalModule,
    Sign: jest.fn(() => 'newToken'),
    SignEmail: jest.fn(() => 'token'),
  };
});

jest.mock('../../lib/jwt');

describe('WorkspacesUsecases', () => {
  let service: WorkspacesUsecases;
  let workspaceRepository: SequelizeWorkspaceRepository;
  let teamRepository: SequelizeWorkspaceTeamRepository;
  let userRepository: SequelizeUserRepository;
  let userUsecases: UserUseCases;
  let mailerService: MailerService;
  let avatarService: AvatarService;
  let networkService: BridgeService;
  let configService: ConfigService;
  let folderUseCases: FolderUseCases;
  let fileUseCases: FileUseCases;
  let sharingUseCases: SharingService;
  let paymentsService: PaymentsService;
  let fuzzySearchUseCases: FuzzySearchUseCases;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkspacesUsecases],
    })
      .setLogger(createMock<Logger>())
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
    avatarService = module.get<AvatarService>(AvatarService);
    networkService = module.get<BridgeService>(BridgeService);
    configService = module.get<ConfigService>(ConfigService);
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
    fileUseCases = module.get<FileUseCases>(FileUseCases);
    sharingUseCases = module.get<SharingService>(SharingService);
    paymentsService = module.get<PaymentsService>(PaymentsService);
    fuzzySearchUseCases = module.get<FuzzySearchUseCases>(FuzzySearchUseCases);
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
          spaceLimit: 1024,
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
          spaceLimit: 1024,
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
        .spyOn(service, 'getOwnerAvailableSpace')
        .mockResolvedValueOnce(6000000);

      jest
        .spyOn(service, 'getWorkspaceFixedStoragePerUser')
        .mockResolvedValueOnce(1024);

      jest.spyOn(configService, 'get').mockResolvedValueOnce('secret' as never);
      jest
        .spyOn(mailerService, 'sendWorkspaceUserExternalInvitation')
        .mockResolvedValueOnce(undefined);

      await expect(
        service.inviteUserToWorkspace(user, 'workspace-id', {
          invitedUser: 'test@example.com',
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
        .spyOn(service, 'getOwnerAvailableSpace')
        .mockResolvedValueOnce(6000000);
      jest
        .spyOn(service, 'getWorkspaceFixedStoragePerUser')
        .mockResolvedValueOnce(1024);

      jest
        .spyOn(mailerService, 'sendWorkspaceUserInvitation')
        .mockResolvedValueOnce(undefined);
      jest.spyOn(configService, 'get').mockResolvedValue('secret' as never);

      await expect(
        service.inviteUserToWorkspace(user, 'workspace-id', {
          invitedUser: 'test@example.com',
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
          spaceLimit: 1024,
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
          spaceLimit: 1024,
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
          spaceLimit: 1024,
          encryptionKey: 'encryptionKey',
          encryptionAlgorithm: 'RSA',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('When invitation space limit is explicitly set and it exceeds the assignable space, then it should throw', async () => {
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
        .mockResolvedValueOnce(spaceLeft);
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValueOnce(null);

      await expect(
        service.inviteUserToWorkspace(user, workspace.id, {
          invitedUser: invitedUserEmail,
          spaceLimit: spaceLeft + 1,
          encryptionKey: 'encryptionKey',
          encryptionAlgorithm: 'RSA',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('When invitation space limit is not explicitly set, then it should use getWorkspaceFixedStoragePerUser()', async () => {
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
        .spyOn(service, 'getOwnerAvailableSpace')
        .mockResolvedValueOnce(spaceLeft);
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValueOnce(null);
      jest
        .spyOn(service, 'getWorkspaceFixedStoragePerUser')
        .mockResolvedValue(1024);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);

      await expect(
        service.inviteUserToWorkspace(user, workspace.id, {
          invitedUser: invitedUserEmail,
          encryptionKey: 'encryptionKey',
          encryptionAlgorithm: 'RSA',
        }),
      ).resolves.not.toThrow();
      expect(service.getWorkspaceFixedStoragePerUser).toHaveBeenCalled();
    });

    it('When invitation space limit is not explicitly set and it exceeds the assignable space, then it should throw', async () => {
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
        .mockResolvedValueOnce(spaceLeft);
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValueOnce(null);
      jest
        .spyOn(service, 'getWorkspaceFixedStoragePerUser')
        .mockResolvedValue(spaceLeft + 1);

      await expect(
        service.inviteUserToWorkspace(user, workspace.id, {
          invitedUser: invitedUserEmail,
          encryptionKey: 'encryptionKey',
          encryptionAlgorithm: 'RSA',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getWorkspaceDetails', () => {
    it('When workspace does not exist, then it should throw', async () => {
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValueOnce(null);

      await expect(service.getWorkspaceDetails(v4())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('When workspace exists, then it should return the workspace details', async () => {
      const workspace = newWorkspace();
      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValueOnce(workspace);

      const result = await service.getWorkspaceDetails(workspace.id);

      expect(result).toEqual(workspace.toJSON());
    });
  });

  describe('editWorkspaceDetails', () => {
    const user = newUser();
    const workspace = newWorkspace({ owner: user });
    const editWorkspaceDto: EditWorkspaceDetailsDto = {
      name: 'Test Workspace',
      description: 'Workspace description',
      address: 'Workspace Address',
    };
    it('When workspace does not exist, then it should throw', async () => {
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValueOnce(null);

      await expect(
        service.editWorkspaceDetails(workspace.id, user, editWorkspaceDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user is not the owner of the workspace, then it should throw', async () => {
      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValueOnce(workspace);

      await expect(
        service.editWorkspaceDetails(workspace.id, newUser(), editWorkspaceDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When the user is the owner of the workspace, then it should update the workspace details', async () => {
      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValueOnce(workspace);

      await expect(
        service.editWorkspaceDetails(workspace.id, user, editWorkspaceDto),
      ).resolves.not.toThrow();

      expect(workspaceRepository.updateBy).toHaveBeenCalledWith(
        {
          id: workspace.id,
        },
        editWorkspaceDto,
      );
    });
    it('When address or phoneNumber are provided, then it should call payments service', async () => {
      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValueOnce(workspace);
      jest.spyOn(paymentsService, 'updateBillingInfo').mockResolvedValueOnce();

      await service.editWorkspaceDetails(workspace.id, user, {
        address: 'new address',
        phoneNumber: 'new phone number',
      });

      expect(paymentsService.updateBillingInfo).toHaveBeenCalledWith(
        user.uuid,
        {
          address: 'new address',
          phoneNumber: 'new phone number',
        },
      );
    });
    it('When address or phoneNumber are provided and payments service for some reason fails, it should throw', async () => {
      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValueOnce(workspace);
      jest
        .spyOn(paymentsService, 'updateBillingInfo')
        .mockRejectedValueOnce(new Error());

      await expect(
        service.editWorkspaceDetails(workspace.id, user, {
          address: 'new address',
          phoneNumber: 'new phone number',
        }),
      ).rejects.toThrow(InternalServerErrorException);

      expect(paymentsService.updateBillingInfo).toHaveBeenCalledWith(
        user.uuid,
        {
          address: 'new address',
          phoneNumber: 'new phone number',
        },
      );

      expect(workspaceRepository.updateBy).not.toHaveBeenCalled();
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
      const workspaceLimit = 1099511627776; // 1TB

      jest
        .spyOn(workspaceRepository, 'findOne')
        .mockResolvedValueOnce(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);

      jest
        .spyOn(service, 'getWorkspaceFixedStoragePerUser')
        .mockResolvedValueOnce(50000);
      jest
        .spyOn(service, 'getWorkspaceNetworkLimit')
        .mockResolvedValueOnce(workspaceLimit);

      await service.setupWorkspace(owner, 'workspace-id', {
        name: 'Test Workspace',
        encryptedMnemonic: 'encryptedMnemonic',
      });

      expect(workspaceRepository.addUserToWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: owner.uuid,
          spaceLimit: workspaceLimit,
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
    it('When workspace has slots left, then workspace is not full', async () => {
      const notFullWorkspace = newWorkspace({
        attributes: { numberOfSeats: 10 },
      });

      jest
        .spyOn(workspaceRepository, 'getWorkspaceUsersCount')
        .mockResolvedValue(5);
      jest
        .spyOn(workspaceRepository, 'getWorkspaceInvitationsCount')
        .mockResolvedValue(4);

      const isFull = await service.isWorkspaceFull(notFullWorkspace);
      expect(isFull).toBe(false);
    });
    it('When workspace does not have slots left, then workspace is full', async () => {
      const fullWorkspace = newWorkspace({
        attributes: { numberOfSeats: 10 },
      });

      jest
        .spyOn(workspaceRepository, 'getWorkspaceUsersCount')
        .mockResolvedValue(10);
      jest
        .spyOn(workspaceRepository, 'getWorkspaceInvitationsCount')
        .mockResolvedValue(0);

      const isFull = await service.isWorkspaceFull(fullWorkspace);
      expect(isFull).toBe(true);
    });
  });

  describe('getUserInvites', () => {
    it('When user invites are searched, then should return successfully', async () => {
      const user = newUser();
      const workspace = newWorkspace();
      const workspace2 = newWorkspace();
      const limit = 10;
      const offset = 0;

      const invites = [
        newWorkspaceInvite({
          invitedUser: user.uuid,
          workspaceId: workspace.id,
        }),
        newWorkspaceInvite({
          invitedUser: user.uuid,
          workspaceId: workspace2.id,
        }),
      ];

      jest
        .spyOn(workspaceRepository, 'findInvitesBy')
        .mockResolvedValueOnce(invites);
      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValueOnce(workspace);
      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValueOnce(workspace2);

      const result = await service.getUserInvites(user, limit, offset);

      expect(result).toEqual([
        { ...invites[0], workspace: workspace.toJSON() },
        { ...invites[1], workspace: workspace2.toJSON() },
      ]);

      expect(workspaceRepository.findInvitesBy).toHaveBeenCalledWith(
        { invitedUser: user.uuid },
        limit,
        offset,
      );
    });

    it('When user invites are searched but no invites are found, then should return nothing', async () => {
      const user = newUser();
      const limit = 10;
      const offset = 0;

      jest
        .spyOn(workspaceRepository, 'findInvitesBy')
        .mockResolvedValueOnce([]);

      const result = await service.getUserInvites(user, limit, offset);

      expect(result).toEqual([]);
    });
  });

  describe('getWorkspacePendingInvitations', () => {
    const workspace = newWorkspace();

    it('When workspace has invitations, then it should return invites with users', async () => {
      const avatarUrl = 'avatarUrl';
      const user = newUser();
      const anotherUser = newUser();
      anotherUser.avatar = avatarUrl;

      const invites = [
        newWorkspaceInvite({
          invitedUser: user.uuid,
          workspaceId: workspace.id,
        }),
        newWorkspaceInvite({
          invitedUser: anotherUser.uuid,
          workspaceId: workspace.id,
        }),
      ];

      jest
        .spyOn(workspaceRepository, 'findInvitesBy')
        .mockResolvedValueOnce(invites);
      jest
        .spyOn(userUsecases, 'findByUuids')
        .mockResolvedValueOnce([user, anotherUser]);
      jest
        .spyOn(userUsecases, 'findPreCreatedUsersByUuids')
        .mockResolvedValueOnce([]);
      jest.spyOn(userUsecases, 'getAvatarUrl').mockResolvedValueOnce(avatarUrl);

      const expectedUsersWithAvatars = [
        { ...user, avatar: null },
        { ...anotherUser, avatar: avatarUrl },
      ];

      const result = await service.getWorkspacePendingInvitations(
        workspace.id,
        10,
        0,
      );

      expect(userUsecases.findByUuids).toHaveBeenCalledWith([
        user.uuid,
        anotherUser.uuid,
      ]);
      expect(userUsecases.findPreCreatedUsersByUuids).toHaveBeenCalledWith([
        user.uuid,
        anotherUser.uuid,
      ]);

      expect(result).toEqual([
        {
          ...invites[0],
          user: expectedUsersWithAvatars[0],
          isGuessInvite: false,
        },
        {
          ...invites[1],
          user: expectedUsersWithAvatars[1],
          isGuessInvite: false,
        },
      ]);
    });

    it('When workspace has invitations for non registered users, then it should return invites with pre created user data', async () => {
      const user = newUser();
      const preCreatedUser = newPreCreatedUser();

      const invites = [
        newWorkspaceInvite({
          invitedUser: user.uuid,
          workspaceId: workspace.id,
        }),
        newWorkspaceInvite({
          invitedUser: preCreatedUser.uuid,
          workspaceId: workspace.id,
        }),
      ];

      jest
        .spyOn(workspaceRepository, 'findInvitesBy')
        .mockResolvedValueOnce(invites);
      jest.spyOn(userUsecases, 'findByUuids').mockResolvedValueOnce([user]);
      jest
        .spyOn(userUsecases, 'findPreCreatedUsersByUuids')
        .mockResolvedValueOnce([preCreatedUser]);

      const expectedUsersWithAvatars = [{ ...user, avatar: null }];

      const result = await service.getWorkspacePendingInvitations(
        workspace.id,
        10,
        0,
      );

      expect(userUsecases.findByUuids).toHaveBeenCalledWith([
        user.uuid,
        preCreatedUser.uuid,
      ]);
      expect(userUsecases.findPreCreatedUsersByUuids).toHaveBeenCalledWith([
        user.uuid,
        preCreatedUser.uuid,
      ]);

      expect(result).toEqual([
        {
          ...invites[0],
          user: expectedUsersWithAvatars[0],
          isGuessInvite: false,
        },
        {
          ...invites[1],
          user: preCreatedUser.toJSON(),
          isGuessInvite: true,
        },
      ]);
    });

    it('When workspace has not invitations, then it should return empty', async () => {
      jest
        .spyOn(workspaceRepository, 'findInvitesBy')
        .mockResolvedValueOnce([]);

      const result = await service.getWorkspacePendingInvitations(
        workspace.id,
        10,
        0,
      );

      expect(result).toEqual([]);
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
        availableWorkspaces: [
          { workspaceUser: workspaceUser.toJSON(), workspace },
        ],
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

  describe('validateWorkspaceInvite', () => {
    it('When invite is not found, then it should throw', async () => {
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(null);
      await expect(service.validateWorkspaceInvite('anyUuid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('When invite is found, then it should return the invite', async () => {
      const invite = newWorkspaceInvite();
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);

      const foundInvite = await service.validateWorkspaceInvite(invite.id);

      expect(foundInvite).toEqual(invite.id);
    });
  });

  describe('adjustOwnerStorage', () => {
    it('When workspace is not found, then it should throw', async () => {
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(null);
      await expect(
        service.adjustOwnerStorage('anyUuid', 1024, 'DEDUCT'),
      ).rejects.toThrow(NotFoundException);
    });

    it('When attempting to deduct storage from owner and owner does not have enough storage, then it should throw', async () => {
      const owner = newUser();
      const workspace = newWorkspace({ owner });
      const ownerUsage = 644245094400; // 600GB
      const workspaceLimit = 1099511627776; // 1TB
      const ownerWorkspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: owner.uuid,
        attributes: { spaceLimit: ownerUsage },
      });
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(ownerWorkspaceUser);
      jest
        .spyOn(service, 'getWorkspaceNetworkLimit')
        .mockResolvedValue(workspaceLimit);
      jest
        .spyOn(service, 'calculateFilesSizeSum')
        .mockResolvedValue(ownerUsage);
      jest.spyOn(service, 'getAssignableSpaceInWorkspace').mockResolvedValue(0);

      await expect(
        service.adjustOwnerStorage(owner.uuid, 536870912000, 'DEDUCT'), // 500GB
      ).rejects.toThrow(BadRequestException);
    });

    it('When owner has enough storage and it is deducted, then it should return successfully', async () => {
      const owner = newUser();
      const workspace = newWorkspace({ owner });
      const ownerUsage = 644245094400; // 600GB
      const workspaceLimit = 1099511627776; // 1TB
      const ownerWorkspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: owner.uuid,
        attributes: { spaceLimit: ownerUsage },
      });
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(ownerWorkspaceUser);
      jest
        .spyOn(service, 'getWorkspaceNetworkLimit')
        .mockResolvedValue(workspaceLimit);
      jest
        .spyOn(service, 'calculateFilesSizeSum')
        .mockResolvedValue(ownerUsage);
      jest.spyOn(service, 'getAssignableSpaceInWorkspace').mockResolvedValue(0);

      await expect(
        service.adjustOwnerStorage(owner.uuid, 53687091200, 'DEDUCT'), // 50GB
      ).resolves.not.toThrow();
    });

    it('When owner has enough storage and it is added, then it should return successfully', async () => {
      const owner = newUser();
      const workspace = newWorkspace({ owner });
      const ownerUsage = 644245094400; // 600GB
      const workspaceLimit = 1099511627776; // 1TB
      const ownerWorkspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: owner.uuid,
        attributes: { spaceLimit: ownerUsage },
      });
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(ownerWorkspaceUser);
      jest
        .spyOn(service, 'getWorkspaceNetworkLimit')
        .mockResolvedValue(workspaceLimit);
      jest
        .spyOn(service, 'calculateFilesSizeSum')
        .mockResolvedValue(ownerUsage);
      jest.spyOn(service, 'getAssignableSpaceInWorkspace').mockResolvedValue(0);

      await expect(
        service.adjustOwnerStorage(owner.uuid, 53687091200, 'ADD'), // 50GB
      ).resolves.not.toThrow();
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

    it('When invite is valid but there are not enough slots in the workspace, then it should throw', async () => {
      const workspace = newWorkspace();
      const invite = newWorkspaceInvite({
        invitedUser: invitedUser.uuid,
        workspaceId: workspace.id,
        attributes: { spaceLimit: 1000 },
      });
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);
      jest.spyOn(service, 'isWorkspaceFull').mockResolvedValueOnce(true);

      await expect(
        service.acceptWorkspaceInvite(invitedUser, 'anyUuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('When invite is valid but there is no enough free storage left, then it should throw', async () => {
      const workspaceUser = newUser();
      const workspace = newWorkspace({
        attributes: { workspaceUserId: workspaceUser.uuid },
      });
      const invite = newWorkspaceInvite({
        invitedUser: invitedUser.uuid,
        workspaceId: workspace.id,
        attributes: { spaceLimit: 4000 },
      });
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);
      jest.spyOn(service, 'isWorkspaceFull').mockResolvedValueOnce(false);
      jest
        .spyOn(userRepository, 'findByUuid')
        .mockResolvedValueOnce(workspaceUser);
      jest.spyOn(service, 'getOwnerAvailableSpace').mockResolvedValueOnce(3000);

      await expect(
        service.acceptWorkspaceInvite(invitedUser, 'anyUuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('When invite is valid, then add user to workspace with respective space limit', async () => {
      const workspaceUser = newUser();
      const workspace = newWorkspace({
        attributes: { workspaceUserId: workspaceUser.uuid },
      });
      const invite = newWorkspaceInvite({
        invitedUser: invitedUser.uuid,
        workspaceId: workspace.id,
        attributes: { spaceLimit: 1000 },
      });
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);
      jest.spyOn(service, 'isWorkspaceFull').mockResolvedValueOnce(false);
      jest
        .spyOn(userRepository, 'findByUuid')
        .mockResolvedValueOnce(workspaceUser);
      jest.spyOn(service, 'getOwnerAvailableSpace').mockResolvedValueOnce(3000);
      jest.spyOn(service, 'adjustOwnerStorage').mockResolvedValueOnce();
      await service.acceptWorkspaceInvite(invitedUser, 'anyUuid');

      expect(workspaceRepository.addUserToWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: invite.invitedUser,
          spaceLimit: invite.spaceLimit,
        }),
      );
      expect(service.adjustOwnerStorage).toHaveBeenCalledWith(
        workspace.id,
        invite.spaceLimit,
        'DEDUCT',
      );
    });

    it('When invite is valid, then add user to default team', async () => {
      const workspaceUser = newUser();
      const workspace = newWorkspace({
        attributes: { workspaceUserId: workspaceUser.uuid },
      });
      const invite = newWorkspaceInvite({
        invitedUser: invitedUser.uuid,
        workspaceId: workspace.id,
        attributes: { spaceLimit: 1000 },
      });
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);
      jest.spyOn(service, 'isWorkspaceFull').mockResolvedValueOnce(false);
      jest
        .spyOn(userRepository, 'findByUuid')
        .mockResolvedValueOnce(workspaceUser);
      jest.spyOn(service, 'getOwnerAvailableSpace').mockResolvedValueOnce(3000);
      jest.spyOn(service, 'adjustOwnerStorage').mockResolvedValueOnce();

      await service.acceptWorkspaceInvite(invitedUser, 'anyUuid');

      expect(teamRepository.addUserToTeam).toHaveBeenCalledWith(
        workspace.defaultTeamId,
        invitedUser.uuid,
      );
    });

    it('When invite is valid and an error is thrown while setting user in team, then it should rollback and throw', async () => {
      const workspaceUser = newUser();
      const workspace = newWorkspace({
        attributes: { workspaceUserId: workspaceUser.uuid },
      });
      const invite = newWorkspaceInvite({
        invitedUser: invitedUser.uuid,
        workspaceId: workspace.id,
        attributes: { spaceLimit: 1000 },
      });

      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);
      jest.spyOn(service, 'isWorkspaceFull').mockResolvedValueOnce(false);
      jest
        .spyOn(userRepository, 'findByUuid')
        .mockResolvedValueOnce(workspaceUser);
      jest.spyOn(service, 'getOwnerAvailableSpace').mockResolvedValueOnce(3000);
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
      const workspaceUser = newUser();
      const workspace = newWorkspace({
        attributes: { workspaceUserId: workspaceUser.uuid },
      });
      const invite = newWorkspaceInvite({
        invitedUser: invitedUser.uuid,
        workspaceId: workspace.id,
        attributes: { spaceLimit: 1000 },
      });

      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);
      jest.spyOn(service, 'isWorkspaceFull').mockResolvedValueOnce(false);
      jest
        .spyOn(userRepository, 'findByUuid')
        .mockResolvedValueOnce(workspaceUser);
      jest.spyOn(service, 'getOwnerAvailableSpace').mockResolvedValueOnce(3000);
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
      const workspaceUser = newUser();
      const workspace = newWorkspace({
        attributes: { workspaceUserId: workspaceUser.uuid },
      });
      const invite = newWorkspaceInvite({
        invitedUser: invitedUser.uuid,
        workspaceId: workspace.id,
        attributes: { spaceLimit: 1000 },
      });
      jest.spyOn(workspaceRepository, 'findInvite').mockResolvedValue(invite);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);
      jest.spyOn(service, 'isWorkspaceFull').mockResolvedValueOnce(false);
      jest
        .spyOn(userRepository, 'findByUuid')
        .mockResolvedValueOnce(workspaceUser);
      jest.spyOn(service, 'getOwnerAvailableSpace').mockResolvedValueOnce(3000);
      jest.spyOn(service, 'adjustOwnerStorage').mockResolvedValueOnce();

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

  describe('getOwnerAvailableSpace', () => {
    it("Should return the owner's available space", async () => {
      const owner = newUser();
      const workspace = newWorkspace({ owner });
      const ownerWorkspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: owner.uuid,
        attributes: { spaceLimit: 1000 },
      });

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(ownerWorkspaceUser);
      jest.spyOn(service, 'calculateFilesSizeSum').mockResolvedValue(500);

      const availableSpace = await service.getOwnerAvailableSpace(workspace);

      expect(availableSpace).toBe(500);
    });
  });

  describe('getAssignableSpaceInWorkspace', () => {
    const workspace = newWorkspace();
    it('When there is space left, then it should return the correct space left', async () => {
      const limit = 1000000;
      const usedByOwner = 500000;
      const assignedInInvitations = 200000;

      jest
        .spyOn(service, 'getOwnerAvailableSpace')
        .mockResolvedValue(limit - usedByOwner);
      jest
        .spyOn(workspaceRepository, 'getSpaceLimitInInvitations')
        .mockResolvedValue(assignedInInvitations);

      const assignableSpace =
        await service.getAssignableSpaceInWorkspace(workspace);
      expect(assignableSpace).toBe(
        limit - (usedByOwner + assignedInInvitations),
      );
    });
  });

  describe('updateWorkspaceMemberCount', () => {
    it('When workspace does not exist, then it should throw', async () => {
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(null);

      await expect(
        service.updateWorkspaceMemberCount('workspaceId', 9),
      ).rejects.toThrow(NotFoundException);
    });

    it('When workspace exists, then it should update the member count', async () => {
      const workspace = newWorkspace();
      const numberOfSeats = 9;
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest.spyOn(workspaceRepository, 'updateById');

      await service.updateWorkspaceMemberCount(workspace.id, numberOfSeats);

      expect(workspaceRepository.updateById).toHaveBeenCalledWith(
        workspace.id,
        { numberOfSeats: numberOfSeats },
      );
    });
  });

  describe('calculateWorkspaceLimits', () => {
    it('When a new limit is specified, calculate spaceDifference', async () => {
      const memberCount = 5;
      const workspace = newWorkspace({
        attributes: {
          numberOfSeats: memberCount,
        },
      });
      const currentSpaceLimit = 10000;
      const newSpaceLimit = currentSpaceLimit * 2;

      jest
        .spyOn(workspaceRepository, 'getWorkspaceUsersCount')
        .mockResolvedValue(memberCount);
      jest
        .spyOn(service, 'getWorkspaceNetworkLimit')
        .mockResolvedValue(currentSpaceLimit);

      const { unusedSpace, spaceDifference } =
        await service.calculateWorkspaceLimits(workspace, newSpaceLimit);

      expect(unusedSpace).toBe(0);

      expect(spaceDifference).toBe(
        (newSpaceLimit - currentSpaceLimit) / memberCount,
      );
    });

    it('When workspace is not full return unusedSpace diiferent than 0', async () => {
      const memberCount = 5;
      const numberOfSeats = 7;
      const workspace = newWorkspace({
        attributes: {
          numberOfSeats,
        },
      });
      const spacePerUser = 10000;
      const currentSpaceLimit = spacePerUser * numberOfSeats;
      const newSpaceLimit = currentSpaceLimit * 2;

      jest
        .spyOn(workspaceRepository, 'getWorkspaceUsersCount')
        .mockResolvedValue(memberCount);
      jest
        .spyOn(service, 'getWorkspaceNetworkLimit')
        .mockResolvedValue(currentSpaceLimit);

      const { unusedSpace, spaceDifference } =
        await service.calculateWorkspaceLimits(workspace, newSpaceLimit);

      expect(unusedSpace).toBe(spacePerUser * (numberOfSeats - memberCount));

      expect(spaceDifference).toBe(spacePerUser * 2 - spacePerUser);
    });

    it('When a different numberOfSeats is specified, spacedifference should vary', async () => {
      const memberCount = 5;
      const numberOfSeats = memberCount;
      const newNumberOfSeats = numberOfSeats * 2;
      const workspace = newWorkspace({
        attributes: {
          numberOfSeats,
        },
      });
      const spacePerUser = 10000;
      const currentSpaceLimit = spacePerUser * numberOfSeats;
      const newSpaceLimit = spacePerUser * newNumberOfSeats;

      jest
        .spyOn(workspaceRepository, 'getWorkspaceUsersCount')
        .mockResolvedValue(memberCount);
      jest
        .spyOn(service, 'getWorkspaceNetworkLimit')
        .mockResolvedValue(currentSpaceLimit);

      const { unusedSpace, spaceDifference } =
        await service.calculateWorkspaceLimits(
          workspace,
          newSpaceLimit,
          newNumberOfSeats,
        );

      expect(unusedSpace).toBe(spacePerUser * (newNumberOfSeats - memberCount));

      expect(spaceDifference).toBe(0);
    });
  });

  describe('validateStorageForPlanChange', () => {
    it('should throw BadRequestException when owner has used up more space than available', async () => {
      const workspace = newWorkspace({ attributes: { numberOfSeats: 4 } });
      const newNumberOfSeats = 3;
      const oneTb = 1099511627776;
      const newWorkspaceSpaceLimit = oneTb * 3;

      jest
        .spyOn(workspaceRepository, 'getWorkspaceUsersCount')
        .mockResolvedValue(5);
      jest.spyOn(service, 'getOwnerAvailableSpace').mockResolvedValue(10000);
      jest
        .spyOn(service, 'calculateWorkspaceLimits')
        .mockResolvedValue({ unusedSpace: -oneTb, spaceDifference: 0 });

      await expect(
        service.validateStorageForPlanChange(
          workspace,
          newWorkspaceSpaceLimit,
          newNumberOfSeats,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Should throw BadRequestException if numberOfSeats specified is less than the number of members in workspace', async () => {
      const workspace = newWorkspace({ attributes: { numberOfSeats: 5 } });
      const newNumberOfSeats = 4;

      jest
        .spyOn(workspaceRepository, 'getWorkspaceUsersCount')
        .mockResolvedValue(5);

      await expect(
        service.validateStorageForPlanChange(workspace, 1000, newNumberOfSeats),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not throw an exception if owner has sufficient space to accomodate the update', async () => {
      const workspace = newWorkspace();
      const oneTb = 1099511627776;
      const newWorkspaceSpaceLimit = oneTb * 5;
      const newNumberOfSeats = 10;

      jest
        .spyOn(workspaceRepository, 'getWorkspaceUsersCount')
        .mockResolvedValue(5);
      jest
        .spyOn(service, 'getOwnerAvailableSpace')
        .mockResolvedValue(oneTb * 4);
      jest
        .spyOn(service, 'calculateWorkspaceLimits')
        .mockResolvedValue({ unusedSpace: oneTb * 5, spaceDifference: 0 });

      await expect(
        service.validateStorageForPlanChange(
          workspace,
          newWorkspaceSpaceLimit,
          newNumberOfSeats,
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('updateWorkspaceLimit', () => {
    it('When workspace does not exist, then it should throw', async () => {
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(null);

      await expect(
        service.updateWorkspaceLimit('workspaceId', 1000),
      ).rejects.toThrow(NotFoundException);
    });

    it('When workspace exists, then it should update the storage limit', async () => {
      const workspaceNetworkUser = newUser();
      const workspaceOwner = newUser();
      const workspace = newWorkspace({
        owner: workspaceOwner,
        attributes: {
          workspaceUserId: workspaceNetworkUser.uuid,
          numberOfSeats: 3,
        },
      });
      const newSpaceLimit = 10995116277760;
      const currentSpaceLimit = newSpaceLimit / 2;
      const workspaceUsers = [
        newWorkspaceUser({
          workspaceId: workspace.id,
          attributes: { spaceLimit: currentSpaceLimit / 4 },
        }),
        newWorkspaceUser({
          workspaceId: workspace.id,
          attributes: { spaceLimit: currentSpaceLimit / 4 },
        }),
        newWorkspaceUser({
          workspaceId: workspace.id,
          member: workspaceOwner,
          attributes: { spaceLimit: currentSpaceLimit / 2 },
        }),
      ];

      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(userRepository, 'findByUuid')
        .mockResolvedValue(workspaceNetworkUser);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsers')
        .mockResolvedValue(workspaceUsers);
      jest.spyOn(workspaceRepository, 'updateWorkspaceUser');
      jest.spyOn(networkService, 'setStorage').mockResolvedValue();
      jest.spyOn(service, 'adjustOwnerStorage').mockResolvedValue();

      const oldSpacePerUser = currentSpaceLimit / workspace.numberOfSeats;
      const newSpacePerUser = newSpaceLimit / workspace.numberOfSeats;
      const unusedSpace =
        newSpaceLimit -
        currentSpaceLimit -
        (newSpacePerUser - oldSpacePerUser) * workspaceUsers.length;

      jest.spyOn(service, 'calculateWorkspaceLimits').mockResolvedValue({
        unusedSpace,
        spaceDifference: newSpacePerUser - oldSpacePerUser,
      });

      await service.updateWorkspaceLimit(workspace.id, newSpaceLimit);

      expect(networkService.setStorage).toHaveBeenCalledWith(
        workspaceNetworkUser.email,
        newSpaceLimit,
      );

      expect(workspaceRepository.updateWorkspaceUser).toHaveBeenCalledTimes(3);

      expect(service.adjustOwnerStorage).toHaveBeenCalledWith(
        workspace.id,
        unusedSpace,
        'ADD',
      );
    });

    it('When numberOfSeats is specified, then it should update the number of seats', async () => {
      const workspaceNetworkUser = newUser();
      const numberOfSeats = 6;
      const newSpaceLimit = 10995116277760;
      const currentSpaceLimit = newSpaceLimit / 2;
      const workspaceOwner = newUser();
      const workspace = newWorkspace({
        owner: workspaceOwner,
        attributes: {
          workspaceUserId: workspaceNetworkUser.uuid,
          numberOfSeats: 3,
        },
      });
      const workspaceUsers = [
        newWorkspaceUser({
          workspaceId: workspace.id,
          attributes: { spaceLimit: currentSpaceLimit / 4 },
        }),
        newWorkspaceUser({
          workspaceId: workspace.id,
          attributes: { spaceLimit: currentSpaceLimit / 4 },
        }),
        newWorkspaceUser({
          workspaceId: workspace.id,
          member: workspaceOwner,
          attributes: { spaceLimit: currentSpaceLimit / 2 },
        }),
      ];
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(userRepository, 'findByUuid')
        .mockResolvedValue(workspaceNetworkUser);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsers')
        .mockResolvedValue(workspaceUsers);
      jest.spyOn(workspaceRepository, 'updateWorkspaceUser');
      jest.spyOn(networkService, 'setStorage').mockResolvedValue();
      jest.spyOn(service, 'adjustOwnerStorage').mockResolvedValue();

      const oldSpacePerUser = currentSpaceLimit / workspace.numberOfSeats;
      const newSpacePerUser = newSpaceLimit / numberOfSeats;
      const unusedSpace =
        newSpaceLimit -
        currentSpaceLimit -
        (newSpacePerUser - oldSpacePerUser) * workspaceUsers.length;

      jest.spyOn(service, 'calculateWorkspaceLimits').mockResolvedValue({
        unusedSpace,
        spaceDifference: newSpacePerUser - oldSpacePerUser,
      });

      await service.updateWorkspaceLimit(
        workspace.id,
        newSpaceLimit,
        numberOfSeats,
      );

      expect(networkService.setStorage).toHaveBeenCalledWith(
        workspaceNetworkUser.email,
        newSpaceLimit,
      );

      expect(workspaceRepository.updateWorkspaceUser).toHaveBeenCalledTimes(3);

      expect(service.adjustOwnerStorage).toHaveBeenCalledWith(
        workspace.id,
        unusedSpace,
        'ADD',
      );
    });
  });

  describe('changeUserAssignedSpace', () => {
    const workspaceId = v4();
    const memberId = v4();
    const changeAssignedSpace = { spaceLimit: 1000 };

    it('When workspace does not exist, then it should throw', async () => {
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(null);

      await expect(
        service.changeUserAssignedSpace(
          workspaceId,
          memberId,
          changeAssignedSpace,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('When member does not exist in the workspace, then it should throw', async () => {
      const workspace = newWorkspace();
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(null);

      await expect(
        service.changeUserAssignedSpace(
          workspaceId,
          memberId,
          changeAssignedSpace,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When new assigned space is greater than assignable space, then it should throw', async () => {
      const workspace = newWorkspace();
      const member = newWorkspaceUser({ attributes: { spaceLimit: 300 } });
      const workspaceUser = newUser();

      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(member);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(workspaceUser);
      jest
        .spyOn(service, 'getAssignableSpaceInWorkspace')
        .mockResolvedValue(500);

      await expect(
        service.changeUserAssignedSpace(
          workspaceId,
          memberId,
          changeAssignedSpace,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("When new space to be assigned is less than the user's used space, then it should throw", async () => {
      const workspace = newWorkspace();
      const member = newWorkspaceUser({ attributes: { spaceLimit: 500 } });
      const workspaceUser = newUser();

      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(member);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(workspaceUser);
      jest
        .spyOn(service, 'getAssignableSpaceInWorkspace')
        .mockResolvedValue(1000);
      jest.spyOn(member, 'getUsedSpace').mockReturnValue(1500);

      await expect(
        service.changeUserAssignedSpace(
          workspaceId,
          memberId,
          changeAssignedSpace,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When new space to be assigned is higher than the max assignable space per user in the workspace, then it should throw', async () => {
      const workspace = newWorkspace({ attributes: { numberOfSeats: 11 } });
      const member = newWorkspaceUser({ attributes: { spaceLimit: 500 } });
      const workspaceUser = newUser();
      const mockedUsedSpace = 400;

      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(member);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(workspaceUser);
      jest
        .spyOn(service, 'getAssignableSpaceInWorkspace')
        .mockResolvedValue(2000);
      jest.spyOn(member, 'getUsedSpace').mockReturnValue(mockedUsedSpace);
      jest.spyOn(service, 'adjustOwnerStorage').mockResolvedValue();
      jest
        .spyOn(service, 'getWorkspaceNetworkLimit')
        .mockResolvedValueOnce(10000);

      await expect(
        service.changeUserAssignedSpace(
          workspaceId,
          memberId,
          changeAssignedSpace,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When new space to be assigned is valid, then it should update the space', async () => {
      const workspace = newWorkspace({ attributes: { numberOfSeats: 5 } });
      const member = newWorkspaceUser({ attributes: { spaceLimit: 500 } });
      const workspaceUser = newUser();
      const mockedUsedSpace = 400;

      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(member);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(workspaceUser);
      jest
        .spyOn(service, 'getAssignableSpaceInWorkspace')
        .mockResolvedValue(2000);
      jest.spyOn(member, 'getUsedSpace').mockReturnValue(mockedUsedSpace);
      jest.spyOn(service, 'adjustOwnerStorage').mockResolvedValue();
      jest.spyOn(service, 'getWorkspaceNetworkLimit').mockResolvedValue(10000);

      const updatedMember = await service.changeUserAssignedSpace(
        workspaceId,
        memberId,
        changeAssignedSpace,
      );

      expect(workspaceRepository.updateWorkspaceUser).toHaveBeenCalledWith(
        member.id,
        member,
      );
      expect(updatedMember).toEqual({
        ...member.toJSON(),
        usedSpace: mockedUsedSpace,
      });
    });
  });

  describe('getWorkspaceUsage', () => {
    const workspace = newWorkspace();

    it('When there is space assigned and pending to be assigned in invitations, assigned space should sum them up', async () => {
      const workspaceUser = newUser();
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(workspaceUser);
      jest.spyOn(networkService, 'getLimit').mockResolvedValue(1000000);
      jest
        .spyOn(workspaceRepository, 'getTotalSpaceLimitInWorkspaceUsers')
        .mockResolvedValue(700000);
      jest
        .spyOn(workspaceRepository, 'getSpaceLimitInInvitations')
        .mockResolvedValue(200000);
      jest
        .spyOn(workspaceRepository, 'getTotalDriveAndBackupUsageWorkspaceUsers')
        .mockResolvedValue(400000);

      const workspaceUsage = await service.getWorkspaceUsage(workspace);

      expect(workspaceUsage).toEqual({
        totalWorkspaceSpace: 1000000,
        spaceAssigned: 700000,
        spaceUsed: 400000,
      });
    });
  });

  describe('getWorkspaceMembers', () => {
    const owner = newUser();
    const workspace = newWorkspace({ owner });

    it('When workspaceId does not exist then it should throw an error', async () => {
      const workspaceId = 'not-exist-uuid';
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getWorkspaceMembers(workspaceId)).rejects.toThrow();
    });

    it('When there are no members then return an object with empty data', async () => {
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsers')
        .mockResolvedValue([]);

      await expect(
        service.getWorkspaceMembers(workspace.id),
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
        service.getWorkspaceMembers(workspace.id),
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

      const fnGetMembers = await service.getWorkspaceMembers(workspace.id);
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

      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);
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
            freeSpace: workspaceUser.getFreeSpace(),
            usedSpace: workspaceUser.getUsedSpace(),
          },
        ],
        disabledUsers: [],
      };

      const fnGetMembers = await service.getWorkspaceMembers(workspace.id);

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

      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);
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
            freeSpace: workspaceUser1.getFreeSpace(),
            usedSpace: workspaceUser1.getUsedSpace(),
          },
          {
            ...workspaceUser2.toJSON(),
            isOwner: false,
            isManager: false,
            freeSpace: workspaceUser2.getFreeSpace(),
            usedSpace: workspaceUser2.getUsedSpace(),
          },
        ],
        disabledUsers: [],
      };

      const getMembers = await service.getWorkspaceMembers(workspace.id);

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
        attributes: { spaceLimit: 1024, driveUsage: 1024 },
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
      const size = 2000;
      const workspaceUserWithNoSpace = newWorkspaceUser({
        attributes: { spaceLimit: 1024, driveUsage: 1024 },
      });

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(workspaceUserWithNoSpace);

      await expect(
        service.createFile(user, workspace.id, {
          ...createFileDto,
          size: BigInt(size),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('When parent folder is not valid, then it should throw', async () => {
      const user = newUser();
      const size = 2000;
      const workspaceUser = newWorkspaceUser({
        attributes: { spaceLimit: 2048, driveUsage: 1024 },
      });

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(workspaceUser);
      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValue(null);

      await expect(
        service.createFile(user, workspace.id, {
          ...createFileDto,
          size: BigInt(size),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('When user does not own the parent folder, then it should throw', async () => {
      const user = newUser();
      const fileSize = 1000;
      const workspaceUser = newWorkspaceUser({
        attributes: { spaceLimit: fileSize + 1 },
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
          size: BigInt(fileSize),
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When parent folder is the workspace root folder, then it should throw', async () => {
      const user = newUser();
      const fileSize = 2000;
      const workspace = newWorkspace({
        attributes: { rootFolderId: createFileDto.folderUuid },
      });
      const workspaceUser = newWorkspaceUser({
        attributes: {
          spaceLimit: fileSize + 1,
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
          size: BigInt(fileSize),
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When workspace user has enough space and parent folder is valid, then it should create file successfully', async () => {
      const user = newUser();
      const fileSize = 2000;
      const workspace = newWorkspace();
      const workspaceUser = newWorkspaceUser({
        attributes: {
          spaceLimit: fileSize + 1,
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
        size: BigInt(fileSize),
      });

      expect(result).toEqual({ ...createdFile, item: createdItemFile });
    });

    it('When creating empty file in workspace and limit not reached, then it should succeed', async () => {
      const user = newUser();
      const workspace = newWorkspace();
      const workspaceUser = newWorkspaceUser({
        attributes: {
          spaceLimit: 10240,
          driveUsage: 0,
          rootFolderId: 'root-folder-uuid',
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
      const emptyFileDto = {
        ...createFileDto,
        size: BigInt(0),
      };

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(workspaceUser);
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(fileUseCases, 'checkWorkspaceEmptyFilesLimit')
        .mockResolvedValue(undefined);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValue(folderItem);
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue({} as any);
      jest.spyOn(fileUseCases, 'createFile').mockResolvedValue(createdFile);
      jest
        .spyOn(workspaceRepository, 'createItem')
        .mockResolvedValue(createdItemFile);

      const result = await service.createFile(user, workspace.id, emptyFileDto);

      expect(fileUseCases.checkWorkspaceEmptyFilesLimit).toHaveBeenCalledWith(
        workspaceUser.memberId,
        workspace,
      );
      expect(fileUseCases.createFile).toHaveBeenCalled();
      expect(result).toEqual({ ...createdFile, item: createdItemFile });
    });

    it('When creating empty file in workspace and limit reached, then it should throw', async () => {
      const user = newUser();
      const workspace = newWorkspace();
      const workspaceUser = newWorkspaceUser({
        attributes: {
          spaceLimit: 10240,
          driveUsage: 0,
        },
        workspaceId: workspace.id,
        member: user,
      });
      const emptyFileDto = {
        ...createFileDto,
        size: BigInt(0),
      };

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(workspaceUser);
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(fileUseCases, 'checkWorkspaceEmptyFilesLimit')
        .mockRejectedValue(
          new BadRequestException(
            'You can not have more empty files in this workspace',
          ),
        );

      await expect(
        service.createFile(user, workspace.id, emptyFileDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('When creating non-empty file in workspace, then it should NOT call empty file check', async () => {
      const user = newUser();
      const fileSize = 2000;
      const workspace = newWorkspace();
      const workspaceUser = newWorkspaceUser({
        attributes: {
          spaceLimit: fileSize + 1,
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
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValue(folderItem);
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue({} as any);
      jest.spyOn(fileUseCases, 'createFile').mockResolvedValue(createdFile);
      jest
        .spyOn(workspaceRepository, 'createItem')
        .mockResolvedValue(createdItemFile);
      const checkWorkspaceEmptyFilesLimitSpy = jest.spyOn(
        fileUseCases,
        'checkWorkspaceEmptyFilesLimit',
      );

      await service.createFile(user, workspace.id, {
        ...createFileDto,
        size: BigInt(fileSize),
      });

      expect(checkWorkspaceEmptyFilesLimitSpy).not.toHaveBeenCalled();
    });
  });

  describe('getPersonalWorkspaceFoldersInFolder', () => {
    const user = newUser();
    const workspace = newWorkspace();
    const limit = 50;
    const offset = 0;
    const sort: 'id' | 'updatedAt' | 'size' | 'plainName' = 'plainName';
    const order: 'ASC' | 'DESC' = 'ASC';

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
        .spyOn(folderUseCases, 'getFoldersInWorkspace')
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

  describe('shareItemWithTeam', () => {
    const user = newUser();
    const workspaceId = v4();

    const shareWithMemberDto = {
      itemType: WorkspaceItemType.File,
      itemId: v4(),
      sharedWith: v4(),
      roleId: v4(),
    };

    it('When item is invalid, then it should throw', async () => {
      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValue(null);

      await expect(
        service.shareItemWithTeam(user, workspaceId, shareWithMemberDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('When item is not owned by user, then it should throw', async () => {
      const item = newWorkspaceItemUser();

      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValue(item);

      await expect(
        service.shareItemWithTeam(user, workspaceId, shareWithMemberDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When member is not part of workspace, then it should throw', async () => {
      const item = newWorkspaceItemUser();

      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValue(item);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(null);

      await expect(
        service.shareItemWithTeam(user, workspaceId, shareWithMemberDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When item is already shared with team, then it should throw', async () => {
      const item = newWorkspaceItemUser({
        attributes: { createdBy: user.uuid },
      });
      const memberInWorkspace = newWorkspaceUser();
      const existentSharing = newSharing();

      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValue(item);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(memberInWorkspace);
      jest
        .spyOn(sharingUseCases, 'findSharingBy')
        .mockResolvedValue(existentSharing);

      await expect(
        service.shareItemWithTeam(user, workspaceId, shareWithMemberDto),
      ).rejects.toThrow(ConflictException);
    });

    it('When item is successfully shared with team, then it should return the created sharing', async () => {
      const workspace = newWorkspace();
      const item = newWorkspaceItemUser({
        createdBy: user.uuid,
        workspaceId: workspace.id,
      });
      const memberInWorkspace = newWorkspaceUser({
        member: user,
        workspaceId: workspace.id,
      });
      const createdSharing = newSharing();

      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValue(item);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(memberInWorkspace);
      jest.spyOn(sharingUseCases, 'findSharingBy').mockResolvedValue(null);
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(sharingUseCases, 'createSharing')
        .mockResolvedValue(createdSharing);

      const result = await service.shareItemWithTeam(
        user,
        workspaceId,
        shareWithMemberDto,
      );

      expect(result).toEqual(createdSharing);
    });
  });

  describe('getItemsInSharedFolder', () => {
    const user = newUser();
    const workspaceId = v4();
    const teamId = v4();
    const folderUuid = v4();
    const itemsType = WorkspaceItemType.Folder;
    const token = null;
    const options = { page: 0, perPage: 50, order: [['plainName', 'asc']] };

    it('When folder is trashed, then it should throw', async () => {
      const folder = newFolder({ attributes: { deleted: true } });
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);

      await expect(
        service.getItemsInSharedFolder(
          workspaceId,
          user,
          folderUuid,
          itemsType,
          token,
          options,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When folder is removed, then it should throw', async () => {
      const folder = newFolder({
        attributes: { deleted: true, removed: true },
      });
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);

      await expect(
        service.getItemsInSharedFolder(
          workspaceId,
          user,
          folderUuid,
          itemsType,
          token,
          options,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When item is not found in workspace, then it should throw', async () => {
      const folder = newFolder();
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValue(null);

      await expect(
        service.getItemsInSharedFolder(
          workspaceId,
          user,
          folderUuid,
          itemsType,
          token,
          options,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('When item is owned by user, then it should return the items in the folder', async () => {
      const folder = newFolder();
      const itemFolder = newWorkspaceItemUser({
        attributes: {
          createdBy: user.uuid,
        },
      });
      const childFolder = newFolder({
        attributes: { parentUuid: folder.uuid },
      });

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValue(itemFolder);
      jest
        .spyOn(folderUseCases, 'getFoldersInWorkspace')
        .mockResolvedValue([childFolder]);

      const result = await service.getItemsInSharedFolder(
        workspaceId,
        user,
        folderUuid,
        itemsType,
        token,
        options,
      );

      expect(result).toEqual({
        items: [
          {
            ...childFolder,
            encryptionKey: null,
            dateShared: null,
            sharedWithMe: null,
          },
        ],
        name: folder.plainName,
        bucket: '',
        encryptionKey: null,
        token: '',
        parent: { uuid: folder.uuid, name: folder.plainName },
        role: 'OWNER',
      });
    });

    it('When token is invalid, then it should throw', async () => {
      const folder = newFolder();
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValue(newWorkspaceItemUser());

      const invalidToken = 'invalidToken';
      (verifyWithDefaultSecret as jest.Mock).mockReturnValue('');

      await expect(
        service.getItemsInSharedFolder(
          workspaceId,
          user,
          folderUuid,
          itemsType,
          invalidToken,
          options,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When user team does not have access to the folder, then it should throw', async () => {
      const folder = newFolder();
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValue(newWorkspaceItemUser());
      jest
        .spyOn(sharingUseCases, 'findSharingsBySharedWithAndAttributes')
        .mockResolvedValue([]);

      (verifyWithDefaultSecret as jest.Mock).mockReturnValue({
        sharedRootFolderId: v4(),
      });

      await expect(
        service.getItemsInSharedFolder(
          workspaceId,
          user,
          folderUuid,
          itemsType,
          token,
          options,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When team has access to the folder, then it should return the items in the folder', async () => {
      const folder = newFolder();
      const itemFolder = newWorkspaceItemUser();
      const sharing = newSharing();
      const workspace = newWorkspace();
      const workspaceUser = newUser();
      const childFolder = newFolder({
        attributes: { parentUuid: folder.uuid },
      });
      const rootFolder = newFolder();
      const sharingRole = newSharingRole();
      sharingRole.role = new Role({
        id: v4(),
        name: 'name',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValue(itemFolder);
      jest.spyOn(sharingUseCases, 'findSharingBy').mockResolvedValue(sharing);
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest.spyOn(userUsecases, 'getUser').mockResolvedValue(workspaceUser);
      jest
        .spyOn(folderUseCases, 'getFolderByUserId')
        .mockResolvedValue(rootFolder);
      jest
        .spyOn(folderUseCases, 'getFoldersInWorkspace')
        .mockResolvedValue([childFolder]);
      jest
        .spyOn(sharingUseCases, 'findSharingRoleBy')
        .mockResolvedValue(sharingRole);
      (generateTokenWithPlainSecret as jest.Mock).mockReturnValue(
        'generatedToken',
      );

      const result = await service.getItemsInSharedFolder(
        workspaceId,
        user,
        folderUuid,
        itemsType,
        token,
        options,
      );

      expect(result).toMatchObject({
        items: [
          {
            ...childFolder,
            encryptionKey: null,
            dateShared: null,
            sharedWithMe: null,
          },
        ],
        token: expect.any(String),
        bucket: rootFolder.bucket,
        parent: { uuid: folder.uuid, name: folder.plainName },
        name: folder.plainName,
        role: sharingRole.role.name,
      });
    });

    it('When user tries to navigate up from shared root folder, then it should throw', async () => {
      const sharedRootFolderId = v4();
      const folder = newFolder({ attributes: { uuid: sharedRootFolderId } });
      const itemFolder = newWorkspaceItemUser();
      const sharing = newSharing();
      const workspace = newWorkspace();
      const workspaceUser = newUser();
      const decodedToken = {
        sharedRootFolderId,
        parentFolderId: sharedRootFolderId,
        folder: { uuid: sharedRootFolderId, id: v4() },
        workspace: { workspaceId, teamId },
        owner: { uuid: v4() },
      };

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValue(itemFolder);
      jest.spyOn(sharingUseCases, 'findSharingBy').mockResolvedValue(sharing);
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest.spyOn(userUsecases, 'getUser').mockResolvedValue(workspaceUser);
      (verifyWithDefaultSecret as jest.Mock).mockReturnValue(decodedToken);

      await expect(
        service.getItemsInSharedFolder(
          workspaceId,
          user,
          folderUuid,
          itemsType,
          'validToken',
          options,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When navigation is neither up nor down, then it should throw', async () => {
      const folder = newFolder();
      const itemFolder = newWorkspaceItemUser();
      const sharing = newSharing();
      const workspace = newWorkspace();
      const workspaceUser = newUser();
      const decodedToken = {
        sharedRootFolderId: v4(),
        parentFolderId: v4(),
        folder: { uuid: v4(), id: v4() },
        workspace: { workspaceId, teamId },
        owner: { uuid: v4() },
      };

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValue(itemFolder);
      jest.spyOn(sharingUseCases, 'findSharingBy').mockResolvedValue(sharing);
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest.spyOn(userUsecases, 'getUser').mockResolvedValue(workspaceUser);
      (verifyWithDefaultSecret as jest.Mock).mockReturnValue(decodedToken);

      await expect(
        service.getItemsInSharedFolder(
          workspaceId,
          user,
          folderUuid,
          itemsType,
          'validToken',
          options,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When item is owned by user and itemsType is File, then it should return the files in the folder', async () => {
      const folder = newFolder();
      const itemFolder = newWorkspaceItemUser({
        attributes: {
          createdBy: user.uuid,
        },
      });
      const childFile = newFile({
        attributes: { folderUuid: folder.uuid },
      });

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValue(itemFolder);
      jest
        .spyOn(fileUseCases, 'getFilesInWorkspace')
        .mockResolvedValue([childFile]);

      const result = await service.getItemsInSharedFolder(
        workspaceId,
        user,
        folderUuid,
        WorkspaceItemType.File,
        token,
        options,
      );

      expect(result).toEqual({
        items: [
          {
            ...childFile,
            encryptionKey: null,
            dateShared: null,
            sharedWithMe: null,
          },
        ],
        name: folder.plainName,
        bucket: '',
        encryptionKey: null,
        token: '',
        parent: { uuid: folder.uuid, name: folder.plainName },
        role: 'OWNER',
      });
    });

    it('When team has access to the folder and itemsType is File, then it should return the files in the folder', async () => {
      const folder = newFolder();
      const itemFolder = newWorkspaceItemUser();
      const sharing = newSharing();
      const workspace = newWorkspace();
      const workspaceUser = newUser();
      const childFile = newFile({
        attributes: { folderUuid: folder.uuid },
      });
      const rootFolder = newFolder();
      const sharingRole = newSharingRole();
      sharingRole.role = new Role({
        id: v4(),
        name: 'name',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValue(itemFolder);
      jest.spyOn(sharingUseCases, 'findSharingBy').mockResolvedValue(sharing);
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest.spyOn(userUsecases, 'getUser').mockResolvedValue(workspaceUser);
      jest
        .spyOn(folderUseCases, 'getFolderByUserId')
        .mockResolvedValue(rootFolder);
      jest
        .spyOn(fileUseCases, 'getFilesInWorkspace')
        .mockResolvedValue([childFile]);
      jest
        .spyOn(sharingUseCases, 'findSharingRoleBy')
        .mockResolvedValue(sharingRole);
      (generateTokenWithPlainSecret as jest.Mock).mockReturnValue(
        'generatedToken',
      );

      const result = await service.getItemsInSharedFolder(
        workspaceId,
        user,
        folderUuid,
        WorkspaceItemType.File,
        token,
        options,
      );

      expect(result).toMatchObject({
        items: [
          {
            ...childFile,
            encryptionKey: null,
            dateShared: null,
            sharedWithMe: null,
          },
        ],
        token: expect.any(String),
        bucket: rootFolder.bucket,
        parent: { uuid: folder.uuid, name: folder.plainName },
        name: folder.plainName,
        role: sharingRole.role.name,
      });
    });
  });

  describe('getPersonalWorkspaceFilesInFolder', () => {
    const user = newUser();
    const workspace = newWorkspace();
    const folder = newFolder();
    const limit = 50;
    const offset = 0;
    const sort = 'plainName';
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

  describe('getWorkspaceCredentials', () => {
    const workspaceUser = newUser();
    const workspace = newWorkspace({
      attributes: { workspaceUserId: workspaceUser.uuid },
    });
    const rootFolder = newFolder();

    it('When workspace user does not exist, then it should fail', async () => {
      jest
        .spyOn(workspaceRepository, 'findOne')
        .mockResolvedValueOnce(workspace);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(null);

      await expect(
        service.getWorkspaceCredentials(workspace.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('When workspace and workspace user exist, then it should return credentials', async () => {
      const tokenText = 'token';

      jest
        .spyOn(workspaceRepository, 'findOne')
        .mockResolvedValueOnce(workspace);
      jest
        .spyOn(userRepository, 'findByUuid')
        .mockResolvedValueOnce(workspaceUser);
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValueOnce(rootFolder);

      jest
        .spyOn(jwtUtils, 'generateWithDefaultSecret')
        .mockReturnValue(tokenText);

      const result = await service.getWorkspaceCredentials(workspace.id);

      expect(result).toEqual({
        workspaceId: workspace.id,
        bucket: rootFolder.bucket,
        workspaceUserId: workspaceUser.uuid,
        email: workspaceUser.email,
        credentials: {
          networkPass: workspaceUser.userId,
          networkUser: workspaceUser.bridgeUser,
        },
        tokenHeader: tokenText,
      });
    });
  });

  describe('getUserUsageInWorkspace', () => {
    const user = newUser();
    const workspace = newWorkspace();

    it('When user is not valid, then it should throw a BadRequestException', async () => {
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(null);

      await expect(
        service.getUserUsageInWorkspace(user, workspace.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('When fetching file sizes, then it should correctly sum the file sizes and update the member usage', async () => {
      const member = newWorkspaceUser();

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValue(member);

      jest
        .spyOn(fileUseCases, 'getWorkspaceFilesSizeSumByStatuses')
        .mockResolvedValueOnce(1100);

      const result = await service.getUserUsageInWorkspace(user, workspace.id);

      expect(workspaceRepository.findWorkspaceUser).toHaveBeenCalledWith({
        memberId: user.uuid,
        workspaceId: workspace.id,
      });

      expect(workspaceRepository.updateWorkspaceUser).toHaveBeenCalledWith(
        member.id,
        {
          driveUsage: 1100,
          lastUsageSyncAt: expect.any(Date),
        },
      );

      expect(result).toEqual({
        driveUsage: 1100,
        backupsUsage: member.backupsUsage,
        spaceLimit: member.spaceLimit,
      });
    });
  });

  describe('calculateFilesSizeSum', () => {
    const user = newUser();
    const workspace = newWorkspace();

    it('When calculating file sizes, then it should correctly sum the sizes in chunks', async () => {
      jest
        .spyOn(fileUseCases, 'getWorkspaceFilesSizeSumByStatuses')
        .mockResolvedValueOnce(300);

      const result = await service.calculateFilesSizeSum(
        user.uuid,
        workspace.id,
        [FileStatus.EXISTS, FileStatus.TRASHED],
      );

      expect(result).toEqual(300);
    });
  });

  describe('isUserCreatorOfItem', () => {
    it('When item does not exist, then fail', async () => {
      const user = newUser();
      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValue(null);

      expect(
        service.isUserCreatorOfItem(user, v4(), WorkspaceItemType.File),
      ).rejects.toThrow(NotFoundException);
    });

    it('When item is not created by user, return false', async () => {
      const user = newUser();
      const owner = newUser();

      const item = newWorkspaceItemUser({ createdBy: owner.uuid });
      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValue(item);

      const result = await service.isUserCreatorOfItem(
        user,
        item.id,
        item.itemType,
      );

      expect(result).toBe(false);
    });

    it('When item is created by user, return true', async () => {
      const owner = newUser();

      const item = newWorkspaceItemUser({ createdBy: owner.uuid });
      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValue(item);

      const result = await service.isUserCreatorOfItem(
        owner,
        item.id,
        item.itemType,
      );

      expect(result).toBe(true);
    });
  });

  describe('isUserCreatorOfAllItems', () => {
    it('When user is not owner of all items, it should return false', async () => {
      const user = newUser();
      const itemNotOwnedByUser = newWorkspaceItemUser({ createdBy: user.uuid });
      const userItems = [newWorkspaceItemUser({ createdBy: user.uuid })];

      const items = [
        { itemId: userItems[0].itemId, itemType: userItems[0].itemType },
        {
          itemId: itemNotOwnedByUser.itemId,
          itemType: itemNotOwnedByUser.itemType,
        },
      ];

      jest
        .spyOn(workspaceRepository, 'getItemsByAttributesAndCreator')
        .mockResolvedValue(userItems);

      const result = await service.isUserCreatorOfAllItems(user, items);

      expect(result).toBe(false);
    });

    it('When user is the owner of all the items, then it returns true', async () => {
      const user = newUser();
      const userItems = [
        newWorkspaceItemUser({ createdBy: user.uuid }),
        newWorkspaceItemUser({ createdBy: user.uuid }),
      ];

      const items = [
        { itemId: userItems[0].itemId, itemType: userItems[0].itemType },
        { itemId: userItems[1].itemId, itemType: userItems[1].itemType },
      ];

      jest
        .spyOn(workspaceRepository, 'getItemsByAttributesAndCreator')
        .mockResolvedValue(userItems);

      const result = await service.isUserCreatorOfAllItems(user, items);

      expect(result).toBe(true);
    });
  });

  describe('getWorkspaceUserTrashedItems', () => {
    const user = newUser();
    const workspaceId = v4();
    const limit = 50;
    const offset = 0;

    it('When files are retrieved, it should return files', async () => {
      const trashedFiles = [newFile()];
      jest
        .spyOn(fileUseCases, 'getFilesInWorkspace')
        .mockResolvedValue(trashedFiles);

      const result = await service.getWorkspaceUserTrashedItems(
        user,
        workspaceId,
        WorkspaceItemType.File,
        limit,
        offset,
        ['plainName', 'ASC'] as any,
      );

      expect(result).toEqual({ result: trashedFiles });
      expect(fileUseCases.getFilesInWorkspace).toHaveBeenCalledWith(
        user.uuid,
        workspaceId,
        { status: FileStatus.TRASHED },
        { limit, offset, sort: ['plainName', 'ASC'] },
      );
    });

    it('When folders are retrieved, it should return folders', async () => {
      const trashedFolders = [newFolder({ attributes: { deleted: true } })];
      jest
        .spyOn(folderUseCases, 'getFoldersInWorkspace')
        .mockResolvedValue(trashedFolders);

      const result = await service.getWorkspaceUserTrashedItems(
        user,
        workspaceId,
        WorkspaceItemType.Folder,
        limit,
        offset,
        ['plainName', 'ASC'] as any,
      );

      expect(result).toEqual({ result: trashedFolders });
      expect(folderUseCases.getFoldersInWorkspace).toHaveBeenCalledWith(
        user.uuid,
        workspaceId,
        { deleted: true, removed: false },
        { limit, offset, sort: ['plainName', 'ASC'] },
      );
    });
  });

  describe('emptyUserTrashedItems', () => {
    const user = newUser();
    const workspaceId = newWorkspace().id;

    it('When there are trashed items, it should delete them in chunks', async () => {
      const filesCount = 150;
      const foldersCount = 120;
      const emptyTrashChunkSize = 100;
      const trashedFiles = [newFile(), newFile()];
      const trashedFolders = [newFolder(), newFolder()];
      const workspaceUser = newUser();

      jest
        .spyOn(workspaceRepository, 'getItemFilesCountBy')
        .mockResolvedValue(filesCount);
      jest
        .spyOn(workspaceRepository, 'getItemFoldersCountBy')
        .mockResolvedValue(foldersCount);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceResourcesOwner')
        .mockResolvedValue(workspaceUser);
      jest
        .spyOn(fileUseCases, 'getFilesInWorkspace')
        .mockResolvedValue(trashedFiles);
      jest
        .spyOn(folderUseCases, 'getFoldersInWorkspace')
        .mockResolvedValue(trashedFolders);

      await service.emptyUserTrashedItems(user, workspaceId);

      expect(fileUseCases.getFilesInWorkspace).toHaveBeenNthCalledWith(
        1,
        user.uuid,
        workspaceId,
        { status: FileStatus.TRASHED },
        { limit: emptyTrashChunkSize, offset: 0 },
      );
      expect(fileUseCases.getFilesInWorkspace).toHaveBeenNthCalledWith(
        2,
        user.uuid,
        workspaceId,
        { status: FileStatus.TRASHED },
        { limit: emptyTrashChunkSize, offset: emptyTrashChunkSize },
      );
      expect(fileUseCases.deleteByUser).toHaveBeenCalledWith(
        workspaceUser,
        trashedFiles,
      );

      expect(folderUseCases.getFoldersInWorkspace).toHaveBeenCalledWith(
        user.uuid,
        workspaceId,
        { deleted: true, removed: false },
        { limit: emptyTrashChunkSize, offset: 0 },
      );
      expect(folderUseCases.deleteByUser).toHaveBeenCalledWith(
        workspaceUser,
        trashedFolders,
      );
    });
  });

  describe('findByOwnerId', () => {
    it('When owner is not null then we should return the workspaces that belongs to the owner', async () => {
      const owner = newUser();
      const workspaceOne = newWorkspace({ owner });
      const workspaceTwo = newWorkspace({ owner });
      const workspaceThree = newWorkspace({
        owner,
        attributes: { setupCompleted: false },
      });

      const mockFindByOwner = [workspaceOne, workspaceTwo, workspaceThree];
      jest
        .spyOn(workspaceRepository, 'findByOwner')
        .mockResolvedValue(mockFindByOwner);

      await expect(service.findByOwnerId(owner.uuid)).resolves.toStrictEqual(
        mockFindByOwner,
      );
    });

    it('When owner is null, then is empty', async () => {
      const spyFindByOwner = jest
        .spyOn(workspaceRepository, 'findByOwner')
        .mockResolvedValue([]);
      await expect(service.findByOwnerId(null)).resolves.toStrictEqual([]);
      expect(spyFindByOwner).toHaveBeenCalledWith(null);
    });
  });

  describe('findOne', () => {
    it('When the attributes are passed then we return the matching workspace', async () => {
      const owner = newUser();
      const workspaceOne = newWorkspace({ owner });
      const workspaceTwo = newWorkspace({
        owner,
        attributes: { setupCompleted: false },
      });

      jest
        .spyOn(workspaceRepository, 'findOne')
        .mockResolvedValueOnce(workspaceOne)
        .mockResolvedValueOnce(workspaceTwo);

      const attributesOne: Partial<WorkspaceAttributes> = {
        ownerId: owner.uuid,
        setupCompleted: true,
      };
      await expect(service.findOne(attributesOne)).resolves.toStrictEqual(
        workspaceOne,
      );

      const attributesTwo: Partial<WorkspaceAttributes> = {
        ownerId: owner.uuid,
        setupCompleted: false,
      };
      await expect(service.findOne(attributesTwo)).resolves.toStrictEqual(
        workspaceTwo,
      );
    });

    it('When attributes is null, then is empty', async () => {
      const spyFindOne = jest
        .spyOn(workspaceRepository, 'findOne')
        .mockResolvedValueOnce(null);
      await expect(service.findOne(undefined)).resolves.toStrictEqual(null);
      expect(spyFindOne).toHaveBeenCalledWith(undefined);
    });
  });

  describe('initiateWorkspace', () => {
    const owner = newUser();
    const maxSpaceBytes = 1000000;
    const workspaceData = { address: '123 Main St', numberOfSeats: 20 };

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

    it('When tierId is provided, then it should update workspace user with tierId', async () => {
      const owner = newUser();
      const tier = newTier();
      const networkUser = { userId: v4(), uuid: v4() };
      const workspaceUser = newUser();
      const newDefaultTeam = newWorkspaceTeam();
      const createdWorkspace = newWorkspace({ owner });
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
      const workspaceDataWithTier = {
        ...workspaceData,
        tierId: tier.id,
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

      await service.initiateWorkspace(
        owner.uuid,
        maxSpaceBytes,
        workspaceDataWithTier,
      );

      expect(userRepository.updateBy).toHaveBeenCalledWith(
        { uuid: workspaceUser.uuid },
        { tierId: tier.id },
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

    describe('activateWorkspaceUser', () => {
      it('When user is not valid or it is not part of workspace, then it should throw', async () => {
        const workspace = newWorkspace();
        const workspaceUser = newWorkspaceUser({ workspaceId: workspace.id });

        jest
          .spyOn(workspaceRepository, 'findWorkspaceUser')
          .mockResolvedValue(null);

        await expect(
          service.activateWorkspaceUser(workspaceUser.memberId, workspace.id),
        ).rejects.toThrow(BadRequestException);
      });

      it('When user is valid, then it is activated', async () => {
        const member = newUser();
        const workspace = newWorkspace();
        const workspaceUser = newWorkspaceUser({
          workspaceId: workspace.id,
          memberId: member.uuid,
        });

        jest
          .spyOn(workspaceRepository, 'findWorkspaceUser')
          .mockResolvedValue(workspaceUser);

        await service.activateWorkspaceUser(
          workspaceUser.memberId,
          workspace.id,
        );

        expect(workspaceRepository.updateWorkspaceUser).toHaveBeenCalledWith(
          workspaceUser.id,
          { deactivated: false },
        );
      });
    });

    describe('getWorkspaceItemBySharingId', () => {
      it('When sharing is not valid, then it should throw', async () => {
        const sharingId = v4();

        jest.spyOn(sharingUseCases, 'findSharingBy').mockResolvedValue(null);

        await expect(
          service.getWorkspaceItemBySharingId(sharingId),
        ).rejects.toThrow(BadRequestException);
      });

      it('When sharing is valid, then it should return item', async () => {
        const sharing = newSharing();
        const item = newWorkspaceItemUser();

        jest.spyOn(sharingUseCases, 'findSharingBy').mockResolvedValue(sharing);
        jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValue(item);

        const result = await service.getWorkspaceItemBySharingId(sharing.id);

        expect(result).toBe(item);
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

      describe('getWorkspaceTeamsUserBelongsTo', () => {
        it('When user teams are fetched, then it should return teams', async () => {
          const userUuid = v4();
          const workspaceId = v4();
          const teams = [
            newWorkspaceTeam({ workspaceId }),
            newWorkspaceTeam({ workspaceId }),
          ];

          jest
            .spyOn(teamRepository, 'getTeamsUserBelongsTo')
            .mockResolvedValueOnce(teams);

          const result = await service.getTeamsUserBelongsTo(
            userUuid,
            workspaceId,
          );

          expect(teams).toBe(result);
        });
      });

      describe('getSharedFoldersInWorkspace', () => {
        const mockUser = newUser();
        const mockWorkspace = newWorkspace({ owner: mockUser });
        const mockTeams = [newWorkspaceTeam({ workspaceId: mockWorkspace.id })];
        const mockFolder = newFolder({ owner: newUser() });
        const mockSharing = newSharing({ item: mockFolder });

        it('When folders shared with user teams are fetched, then it returns successfully', async () => {
          const mockFolderWithSharedInfo = {
            ...mockFolder,
            encryptionKey: mockSharing.encryptionKey,
            dateShared: mockSharing.createdAt,
            sharedWithMe: false,
            sharingId: mockSharing.id,
            sharingType: mockSharing.type,
            credentials: {
              networkPass: mockUser.userId,
              networkUser: mockUser.bridgeUser,
            },
          } as FolderWithSharedInfo;

          jest
            .spyOn(service, 'getWorkspaceTeamsUserBelongsTo')
            .mockResolvedValue(mockTeams);
          jest
            .spyOn(sharingUseCases, 'getSharedFoldersInWorkspaceByTeams')
            .mockResolvedValue({
              folders: [mockFolderWithSharedInfo],
              files: [],
              credentials: {
                networkPass: mockUser.userId,
                networkUser: mockUser.bridgeUser,
              },
              token: '',
              role: 'OWNER',
            });

          const result = await service.getSharedFoldersInWorkspace(
            mockUser,
            mockWorkspace.id,
            {
              offset: 0,
              limit: 10,
              order: [['createdAt', 'DESC']],
            },
          );

          expect(service.getWorkspaceTeamsUserBelongsTo).toHaveBeenCalledWith(
            mockUser.uuid,
            mockWorkspace.id,
          );
          expect(result.folders[0]).toMatchObject({
            plainName: mockFolder.plainName,
            sharingId: mockSharing.id,
            encryptionKey: mockSharing.encryptionKey,
            dateShared: mockSharing.createdAt,
            sharedWithMe: false,
          });
        });
      });

      describe('getSharedFilesInWorkspace', () => {
        const mockUser = newUser();
        const mockWorkspace = newWorkspace({ owner: mockUser });
        const mockTeams = [newWorkspaceTeam({ workspaceId: mockWorkspace.id })];
        const mockFile = newFile({ owner: newUser() });
        const mockSharing = newSharing({ item: mockFile });

        it('When files shared with user teams are fetched, then it returns successfully', async () => {
          const mockFileWithSharedInfo = {
            ...mockFile,
            encryptionKey: mockSharing.encryptionKey,
            dateShared: mockSharing.createdAt,
            sharedWithMe: false,
            sharingId: mockSharing.id,
            sharingType: mockSharing.type,
            credentials: {
              networkPass: mockUser.userId,
              networkUser: mockUser.bridgeUser,
            },
          } as FileWithSharedInfo;

          jest
            .spyOn(service, 'getWorkspaceTeamsUserBelongsTo')
            .mockResolvedValue(mockTeams);
          jest
            .spyOn(sharingUseCases, 'getSharedFilesInWorkspaceByTeams')
            .mockResolvedValue({
              files: [mockFileWithSharedInfo],
              folders: [],
              credentials: {
                networkPass: mockUser.userId,
                networkUser: mockUser.bridgeUser,
              },
              token: '',
              role: 'OWNER',
            });

          const result = await service.getSharedFilesInWorkspace(
            mockUser,
            mockWorkspace.id,
            {
              offset: 0,
              limit: 10,
              order: [['createdAt', 'DESC']],
            },
          );

          expect(service.getWorkspaceTeamsUserBelongsTo).toHaveBeenCalledWith(
            mockUser.uuid,
            mockWorkspace.id,
          );

          expect(result.files[0]).toMatchObject({
            name: mockFile.name,
            sharingId: mockSharing.id,
            encryptionKey: mockSharing.encryptionKey,
            dateShared: mockSharing.createdAt,
            sharedWithMe: false,
          });
        });
      });

      describe('getWorkspaceTeams', () => {
        it('When workspace is not found, then fail', async () => {
          const user = newUser();
          const workspaceId = v4();

          jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(null);

          await expect(
            service.getWorkspaceTeams(user, workspaceId),
          ).rejects.toThrow(BadRequestException);
        });

        it('When user is the workspace owner, then retrieve all teams except default', async () => {
          const user = newUser();
          const workspace = newWorkspace({ owner: user });
          const teams = [
            newWorkspaceTeam({ workspaceId: workspace.id }),
            newWorkspaceTeam({ workspaceId: workspace.id }),
            newWorkspaceTeam({ workspaceId: workspace.id }),
          ];
          const teamsWithMemberCount = [
            { team: teams[0], membersCount: 5 },
            { team: teams[1], membersCount: 10 },
            { team: teams[2], membersCount: 7 },
          ];
          const teamsUserBelongsTo = [teams[1]];
          workspace.defaultTeamId = teams[0].id;

          jest
            .spyOn(workspaceRepository, 'findOne')
            .mockResolvedValue(workspace);
          jest
            .spyOn(teamRepository, 'getTeamsAndMembersCountByWorkspace')
            .mockResolvedValue(teamsWithMemberCount);
          jest
            .spyOn(teamRepository, 'getTeamsUserBelongsTo')
            .mockResolvedValue(teamsUserBelongsTo);

          const result = await service.getWorkspaceTeams(user, workspace.id);

          expect(result).toEqual([
            teamsWithMemberCount[1],
            teamsWithMemberCount[2],
          ]);
        });

        it('When user is not the owner and belongs to a team, then retrieve user teams except default', async () => {
          const owner = newUser();
          const user = newUser();
          const workspace = newWorkspace({ owner });
          const teams = [
            newWorkspaceTeam({ workspaceId: workspace.id }),
            newWorkspaceTeam({ workspaceId: workspace.id }),
            newWorkspaceTeam({ workspaceId: workspace.id }),
          ];
          const teamsWithMemberCount = [
            { team: teams[0], membersCount: 5 },
            { team: teams[1], membersCount: 10 },
            { team: teams[2], membersCount: 7 },
          ];
          const teamsUserBelongsTo = [teams[1]];
          workspace.defaultTeamId = teams[0].id;

          jest
            .spyOn(workspaceRepository, 'findOne')
            .mockResolvedValue(workspace);
          jest
            .spyOn(teamRepository, 'getTeamsAndMembersCountByWorkspace')
            .mockResolvedValue(teamsWithMemberCount);
          jest
            .spyOn(teamRepository, 'getTeamsUserBelongsTo')
            .mockResolvedValue(teamsUserBelongsTo);

          const result = await service.getWorkspaceTeams(user, workspace.id);

          expect(result).toEqual([teamsWithMemberCount[1]]);
        });

        it('When user is not the owner and does not belong to any team, then return empty array', async () => {
          const owner = newUser();
          const user = newUser();
          const workspace = newWorkspace({ owner });
          const teams = [newWorkspaceTeam({ workspaceId: workspace.id })];
          const teamsWithMemberCount = [{ team: teams[0], membersCount: 5 }];
          workspace.defaultTeamId = teams[0].id;

          jest
            .spyOn(workspaceRepository, 'findOne')
            .mockResolvedValue(workspace);
          jest
            .spyOn(teamRepository, 'getTeamsAndMembersCountByWorkspace')
            .mockResolvedValue(teamsWithMemberCount);
          jest
            .spyOn(teamRepository, 'getTeamsUserBelongsTo')
            .mockResolvedValue([]);

          const result = await service.getWorkspaceTeams(user, workspace.id);

          expect(result).toEqual([]);
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
        const workspaceMembers = [
          newWorkspaceUser({
            workspaceId: workspace.id,
            memberId: user.uuid,
            member: user,
          }),
          newWorkspaceUser({
            workspaceId: workspace.id,
          }),
        ];
        jest
          .spyOn(workspaceRepository, 'findById')
          .mockResolvedValue(workspace);
        jest
          .spyOn(workspaceRepository, 'findWorkspaceUsers')
          .mockResolvedValue(workspaceMembers);

        await service.deleteWorkspaceContent(workspace.id, user);

        expect(workspaceRepository.deleteById).toHaveBeenCalledWith(
          workspace.id,
        );
      });
    });

    describe('transferPersonalItemsToWorkspaceOwner', () => {
      it('When workspace is not found, then it should throw', async () => {
        const workspaceId = v4();
        const user = newUser();
        jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(null);

        await expect(
          service.transferPersonalItemsToWorkspaceOwner(workspaceId, user),
        ).rejects.toThrow(NotFoundException);
      });

      it('When user is the owner of the workspace, then it should throw', async () => {
        const user = newUser();
        const workspace = newWorkspace({ owner: user });
        jest
          .spyOn(workspaceRepository, 'findById')
          .mockResolvedValue(workspace);

        await expect(
          service.transferPersonalItemsToWorkspaceOwner(workspace.id, user),
        ).rejects.toThrow(ForbiddenException);
      });

      it('When user has no items in the workspace, then it should resolve', async () => {
        const workspaceOwner = newUser();
        const workspaceNetworkUser = newUser();
        const member = newUser();
        const workspace = newWorkspace({
          owner: workspaceOwner,
        });
        const folderToMove = newFolder();
        const memberWorkspaceUser = newWorkspaceUser({
          workspaceId: workspace.id,
          member: member,
          memberId: member.uuid,
          attributes: {
            rootFolderId: folderToMove.uuid,
          },
        });
        const ownerWorkspaceUser = newWorkspaceUser({
          workspaceId: workspace.id,
          member: workspaceOwner,
          memberId: workspaceOwner.uuid,
          attributes: {
            spaceLimit: 1099511627776, // 1TB
          },
        });

        jest
          .spyOn(workspaceRepository, 'findById')
          .mockResolvedValueOnce(workspace);
        jest
          .spyOn(workspaceRepository, 'findWorkspaceUser')
          .mockResolvedValueOnce(ownerWorkspaceUser)
          .mockResolvedValueOnce(memberWorkspaceUser);
        jest
          .spyOn(userRepository, 'findByUuid')
          .mockResolvedValueOnce(workspaceNetworkUser);
        jest
          .spyOn(folderUseCases, 'getByUuid')
          .mockResolvedValueOnce(folderToMove);
        jest
          .spyOn(fileUseCases, 'getFilesInWorkspace')
          .mockResolvedValueOnce([]);
        jest
          .spyOn(folderUseCases, 'getFoldersInWorkspace')
          .mockResolvedValueOnce([]);
        jest
          .spyOn(service, 'calculateFilesSizeSum')
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(483183820800); // 450 GB

        await expect(
          service.transferPersonalItemsToWorkspaceOwner(workspace.id, member),
        ).resolves.toBeUndefined();
        expect(folderUseCases.moveFolder).not.toHaveBeenCalled();
      });

      it("When owner doesn't have enough free space then it shoudl throw", async () => {
        const workspaceOwner = newUser();
        const workspaceNetworkUser = newUser();
        const member = newUser();
        const workspace = newWorkspace({
          owner: workspaceOwner,
        });
        const folderToMove = newFolder();
        const memberWorkspaceUser = newWorkspaceUser({
          workspaceId: workspace.id,
          member: member,
          memberId: member.uuid,
          attributes: {
            rootFolderId: folderToMove.uuid,
          },
        });
        const ownerWorkspaceUser = newWorkspaceUser({
          workspaceId: workspace.id,
          member: workspaceOwner,
          memberId: workspaceOwner.uuid,
          attributes: {
            spaceLimit: 1099511627776, // 1TB
          },
        });

        jest
          .spyOn(workspaceRepository, 'findById')
          .mockResolvedValueOnce(workspace);
        jest
          .spyOn(workspaceRepository, 'findWorkspaceUser')
          .mockResolvedValueOnce(ownerWorkspaceUser)
          .mockResolvedValueOnce(memberWorkspaceUser);
        jest
          .spyOn(userRepository, 'findByUuid')
          .mockResolvedValueOnce(workspaceNetworkUser);
        jest
          .spyOn(folderUseCases, 'getByUuid')
          .mockResolvedValueOnce(folderToMove);

        jest
          .spyOn(service, 'calculateFilesSizeSum')
          .mockResolvedValueOnce(483183820800) // 450GB
          .mockResolvedValueOnce(644245094400); // 600 GB

        await expect(
          service.transferPersonalItemsToWorkspaceOwner(workspace.id, member),
        ).rejects.toThrow(BadRequestException);
      });

      it("When user is not the owner of the workspace, then it should move the member's root folder to the workspace owner's root folder", async () => {
        const workspaceOwner = newUser();
        const workspaceNetworkUser = newUser();
        const member = newUser();
        const workspace = newWorkspace({
          owner: workspaceOwner,
        });
        const folderToMove = newFolder();
        const memberWorkspaceUser = newWorkspaceUser({
          workspaceId: workspace.id,
          member: member,
          memberId: member.uuid,
          attributes: {
            rootFolderId: folderToMove.uuid,
          },
        });
        const ownerWorkspaceUser = newWorkspaceUser({
          workspaceId: workspace.id,
          member: workspaceOwner,
          memberId: workspaceOwner.uuid,
          attributes: {
            spaceLimit: 1099511627776, // 1TB
          },
        });
        const resultingFolder = Object.assign(newFolder(), folderToMove, {
          parentUuid: ownerWorkspaceUser.rootFolderId,
        });
        const resultingRenamedFolder = Object.assign(
          newFolder(),
          resultingFolder,
          {
            plainName: member.username,
            name: 'encrypted-name',
          },
        );

        jest
          .spyOn(workspaceRepository, 'findById')
          .mockResolvedValueOnce(workspace);
        jest
          .spyOn(workspaceRepository, 'findWorkspaceUser')
          .mockResolvedValueOnce(ownerWorkspaceUser)
          .mockResolvedValueOnce(memberWorkspaceUser);
        jest
          .spyOn(userRepository, 'findByUuid')
          .mockResolvedValueOnce(workspaceNetworkUser);
        jest
          .spyOn(folderUseCases, 'getByUuid')
          .mockResolvedValueOnce(folderToMove);
        jest
          .spyOn(fileUseCases, 'getFilesInWorkspace')
          .mockResolvedValueOnce([newFile()]);
        jest
          .spyOn(folderUseCases, 'getFoldersInWorkspace')
          .mockResolvedValue([]);
        jest
          .spyOn(folderUseCases, 'moveFolder')
          .mockResolvedValueOnce(resultingFolder);
        jest
          .spyOn(folderUseCases, 'renameFolder')
          .mockResolvedValueOnce(resultingRenamedFolder);
        jest
          .spyOn(service, 'calculateFilesSizeSum')
          .mockResolvedValueOnce(483183820800) // 450 GB
          .mockResolvedValueOnce(483183820800); // 450 GB

        const shortIdentifier = Buffer.from(memberWorkspaceUser.id)
          .toString('base64')
          .substring(0, 6);

        await expect(
          service.transferPersonalItemsToWorkspaceOwner(workspace.id, member),
        ).resolves.toBeUndefined();
        expect(folderUseCases.moveFolder).toHaveBeenCalledWith(
          workspaceNetworkUser,
          folderToMove.uuid,
          { destinationFolder: ownerWorkspaceUser.rootFolderId },
        );
        expect(folderUseCases.renameFolder).toHaveBeenCalledWith(
          resultingFolder,
          `${member.username} - ${shortIdentifier}`,
        );
      });
    });

    describe('removeMemberFromWorkspace', () => {
      it('When member is not found, then it should throw', async () => {
        const workspaceId = v4();
        const memberId = v4();
        jest
          .spyOn(workspaceRepository, 'findWorkspaceUser')
          .mockResolvedValue(null);

        await expect(
          service.removeWorkspaceMember(workspaceId, memberId),
        ).rejects.toThrow(NotFoundException);
      });

      it('When member is the owner of the workspace, then it should throw', async () => {
        const owner = newUser();
        const workspace = newWorkspace({ owner });
        const workspaceUser = newWorkspaceUser({
          workspaceId: workspace.id,
          memberId: owner.uuid,
          member: owner,
        });

        jest
          .spyOn(workspaceRepository, 'findWorkspaceUser')
          .mockResolvedValue(workspaceUser);
        jest
          .spyOn(workspaceRepository, 'findById')
          .mockResolvedValue(workspace);

        await expect(
          service.removeWorkspaceMember(workspace.id, owner.uuid),
        ).rejects.toThrow(BadRequestException);
      });

      it('When member is not the owner of the workspace, then it should remove the member', async () => {
        const owner = newUser();
        const member = newUser();
        const workspace = newWorkspace({ owner });
        const workspaceUser = newWorkspaceUser({
          workspaceId: workspace.id,
          memberId: member.uuid,
          member,
          attributes: {
            spaceLimit: 1099511627776, // 1TB
          },
        });
        const team = newWorkspaceTeam({
          workspaceId: workspace.id,
        });

        jest
          .spyOn(workspaceRepository, 'findWorkspaceUser')
          .mockResolvedValue(workspaceUser);
        jest
          .spyOn(workspaceRepository, 'findById')
          .mockResolvedValue(workspace);
        jest.spyOn(workspaceRepository, 'deleteUserFromWorkspace');
        jest
          .spyOn(service, 'calculateFilesSizeSum')
          .mockResolvedValueOnce(483183820800) // 450 GB
          .mockResolvedValueOnce(483183820800); // 450 GB
        jest
          .spyOn(teamRepository, 'getTeamsUserBelongsTo')
          .mockResolvedValueOnce([team]);
        jest.spyOn(service, 'adjustOwnerStorage').mockResolvedValueOnce();

        expect(
          await service.removeWorkspaceMember(workspace.id, member.uuid),
        ).toBeUndefined();

        expect(
          workspaceRepository.deleteUserFromWorkspace,
        ).toHaveBeenCalledWith(member.uuid, workspace.id);

        expect(teamRepository.deleteUserFromTeam).toHaveBeenCalledWith(
          member.uuid,
          team.id,
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

      it('When user has items in the workspace, then those should transfer to the workspace owner', async () => {
        const user = newUser();
        const workspace = newWorkspace();
        const workspaceUser = newWorkspaceUser({
          memberId: user.uuid,
          workspaceId: workspace.id,
          attributes: {
            spaceLimit: 1099511627776, // 1TB
          },
        });
        jest
          .spyOn(workspaceRepository, 'findById')
          .mockResolvedValue(workspace);
        jest
          .spyOn(workspaceRepository, 'findWorkspaceUser')
          .mockResolvedValue(workspaceUser);
        jest.spyOn(service, 'transferPersonalItemsToWorkspaceOwner');
        jest
          .spyOn(service, 'calculateFilesSizeSum')
          .mockResolvedValueOnce(483183820800) // 450 GB
          .mockResolvedValueOnce(483183820800); // 450 GB
        jest.spyOn(service, 'adjustOwnerStorage').mockResolvedValueOnce();

        await service.leaveWorkspace(workspace.id, user);

        expect(
          service.transferPersonalItemsToWorkspaceOwner,
        ).toHaveBeenCalledWith(workspace.id, user);
        expect(service.adjustOwnerStorage).toHaveBeenCalledWith(
          workspace.id,
          workspaceUser.spaceLimit,
          'ADD',
        );
      });

      it('When the user is a manager, then the workspace owner is set as manager of those teams', async () => {
        const user = newUser();
        const workspaceOwner = newUser();
        const workspace = newWorkspace({ owner: workspaceOwner });
        const workspaceUser = newWorkspaceUser({
          memberId: user.uuid,
          workspaceId: workspace.id,
          attributes: {
            spaceLimit: 1099511627776, // 1TB
          },
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
        jest
          .spyOn(service, 'calculateFilesSizeSum')
          .mockResolvedValueOnce(483183820800) // 450 GB
          .mockResolvedValueOnce(483183820800); // 450 GB
        jest.spyOn(service, 'adjustOwnerStorage').mockResolvedValueOnce();

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

      it('When user is not a manager of any teams and has no items in the workspace, then they should leave the workspace', async () => {
        const user = newUser();
        const workspace = newWorkspace();
        const workspaceUser = newWorkspaceUser({
          memberId: user.uuid,
          workspaceId: workspace.id,
          attributes: {
            spaceLimit: 1099511627776, // 1TB
          },
        });

        jest
          .spyOn(workspaceRepository, 'findById')
          .mockResolvedValue(workspace);
        jest
          .spyOn(workspaceRepository, 'findWorkspaceUser')
          .mockResolvedValue(workspaceUser);
        jest
          .spyOn(service, 'calculateFilesSizeSum')
          .mockResolvedValueOnce(0) // 450 GB
          .mockResolvedValueOnce(483183820800); // 450 GB
        jest.spyOn(service, 'adjustOwnerStorage').mockResolvedValueOnce();

        await service.leaveWorkspace(workspace.id, user);

        expect(
          workspaceRepository.deleteUserFromWorkspace,
        ).toHaveBeenCalledWith(user.uuid, workspace.id);
      });
    });

    describe('upload workspace Avatar', () => {
      const newAvatarKey = v4();
      const newAvatarURL = `http://localhost:9000/${newAvatarKey}`;

      it('When a workspace id not exist then it fails', async () => {
        jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(null);

        await expect(
          service.upsertAvatar('workspace-uuid-not-exist', newAvatarKey),
        ).rejects.toThrow(BadRequestException);
      });

      it('When workspace has no avatar already, then previous avatar is not deleted', async () => {
        const workspace = newWorkspace({
          avatar: null,
        });

        jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);

        await expect(
          service.deleteAvatar(workspace.id),
        ).resolves.toBeUndefined();

        expect(avatarService.deleteAvatar).not.toHaveBeenCalled();
      });

      it('When workspace has an avatar, then avatar is deleted and updated with the new one', async () => {
        const workspace = newWorkspace({
          avatar: v4(),
        });

        jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);

        jest.spyOn(service, 'getAvatarUrl').mockResolvedValue(newAvatarURL);

        await expect(
          service.upsertAvatar(workspace.id, newAvatarKey),
        ).resolves.toMatchObject({ avatar: newAvatarURL });

        expect(avatarService.deleteAvatar).toHaveBeenCalledWith(
          workspace.avatar,
        );
        expect(workspaceRepository.updateById).toHaveBeenCalledWith(
          workspace.id,
          {
            avatar: newAvatarKey,
          },
        );
      });

      it('When there is an error while deleting the previous avatar, then it fails', async () => {
        const workspace = newWorkspace({
          avatar: v4(),
        });

        jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);

        jest
          .spyOn(avatarService, 'deleteAvatar')
          .mockRejectedValue(new Error('Error in avatar service'));

        await expect(service.deleteAvatar(workspace.id)).rejects.toThrow();
      });

      it('When there is an error while updating the avatar, then it fails', async () => {
        const workspace = newWorkspace({
          avatar: v4(),
        });

        jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);

        jest
          .spyOn(workspaceRepository, 'updateById')
          .mockRejectedValue(
            new Error('Error in workspaceRepository updateById'),
          );

        await expect(
          service.upsertAvatar(workspace.id, newAvatarKey),
        ).rejects.toThrow();
      });

      it('When there is an error getting the new avatar URL, then it fails', async () => {
        const workspace = newWorkspace({
          avatar: v4(),
        });

        jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);

        jest.spyOn(workspaceRepository, 'updateById').mockResolvedValue();

        jest
          .spyOn(service, 'getAvatarUrl')
          .mockRejectedValue(
            new Error('Error in WorkspacesUsecases getAvatarUrl'),
          );

        await expect(
          service.upsertAvatar(workspace.id, newAvatarKey),
        ).rejects.toThrow();
      });
    });

    describe('delete workspace Avatar', () => {
      it('When a workspace id not exist then it fails', async () => {
        jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(null);

        await expect(
          service.deleteAvatar('workspace-uuid-not-exist'),
        ).rejects.toThrow(BadRequestException);
      });

      it('When avatar is null it should return empty', async () => {
        const workspace = newWorkspace({
          avatar: null,
        });

        jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);

        await expect(
          service.deleteAvatar(workspace.id),
        ).resolves.toBeUndefined();
      });

      it('When avatar is not null then we should delete the avatar and return empty', async () => {
        const workspace = newWorkspace({
          avatar: v4(),
        });

        jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);

        await expect(
          service.deleteAvatar(workspace.id),
        ).resolves.toBeUndefined();

        expect(avatarService.deleteAvatar).toHaveBeenCalledWith(
          workspace.avatar,
        );
        expect(workspaceRepository.updateById).toHaveBeenCalledWith(
          workspace.id,
          {
            avatar: null,
          },
        );
      });

      it('When there is an error while deleting the avatar from bucket, then it fail', async () => {
        const workspace = newWorkspace({
          avatar: v4(),
        });

        jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);

        jest
          .spyOn(avatarService, 'deleteAvatar')
          .mockRejectedValue(new Error('Error in avatar service'));

        await expect(service.deleteAvatar(workspace.id)).rejects.toThrow();
      });

      it('When there is an error while removing the old avatar from the workspace, then it fails', async () => {
        const workspace = newWorkspace({
          avatar: v4(),
        });

        jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);

        jest
          .spyOn(workspaceRepository, 'updateById')
          .mockRejectedValue(
            new Error('Error in workspaceRepository updateById'),
          );

        await expect(service.deleteAvatar(workspace.id)).rejects.toThrow();
      });
    });
  });

  describe('getItemSharedWith', () => {
    const user = newUser();
    const workspace = newWorkspace({ owner: user });
    const itemId = v4();
    const itemType = WorkspaceItemType.File;

    it('When item is not found in workspace, then it should throw', async () => {
      jest.spyOn(fileUseCases, 'getByUuid').mockResolvedValueOnce(null);
      jest.spyOn(workspaceRepository, 'getItemBy').mockResolvedValueOnce(null);

      await expect(
        service.getItemSharedWith(user, workspace.id, itemId, itemType),
      ).rejects.toThrow(NotFoundException);
    });

    it('When item is not being shared, then it should throw', async () => {
      const mockFile = newFile({ owner: user });
      const mockWorkspaceFile = newWorkspaceItemUser({
        itemId: mockFile.uuid,
        itemType: WorkspaceItemType.File,
      });
      jest.spyOn(fileUseCases, 'getByUuid').mockResolvedValueOnce(mockFile);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValueOnce(mockWorkspaceFile);
      jest
        .spyOn(sharingUseCases, 'findSharingsWithRolesByItem')
        .mockResolvedValueOnce([]);

      await expect(
        service.getItemSharedWith(user, workspace.id, itemId, itemType),
      ).rejects.toThrow(BadRequestException);
    });

    it('When user is not the owner, invited or part of shared team, then it should throw', async () => {
      const mockFile = newFile({ owner: newUser() });
      const mockWorkspaceFile = newWorkspaceItemUser({
        itemId: mockFile.uuid,
        itemType: WorkspaceItemType.File,
      });
      const mockRole = newRole();
      const mockSharing = newSharing({
        item: mockFile,
      });

      jest.spyOn(fileUseCases, 'getByUuid').mockResolvedValueOnce(mockFile);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValueOnce(mockWorkspaceFile);
      jest
        .spyOn(sharingUseCases, 'findSharingsWithRolesByItem')
        .mockResolvedValueOnce([{ ...mockSharing, role: mockRole }]);
      jest
        .spyOn(service, 'getWorkspaceTeamsUserBelongsTo')
        .mockResolvedValueOnce([]);

      await expect(
        service.getItemSharedWith(user, workspace.id, itemId, itemType),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When user is owner, then it should return shared info', async () => {
      const file = newFile();
      const workspaceFile = newWorkspaceItemUser({
        itemId: file.uuid,
        itemType: WorkspaceItemType.File,
        attributes: { createdBy: user.uuid },
      });
      const role = newRole();
      const sharing = newSharing({
        item: file,
      });

      jest.spyOn(fileUseCases, 'getByUuid').mockResolvedValueOnce(file);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValueOnce(workspaceFile);
      jest
        .spyOn(sharingUseCases, 'findSharingsWithRolesByItem')
        .mockResolvedValueOnce([{ ...sharing, role }]);
      jest
        .spyOn(service, 'getWorkspaceTeamsUserBelongsTo')
        .mockResolvedValueOnce([]);
      jest.spyOn(userUsecases, 'findByUuids').mockResolvedValueOnce([user]);
      jest
        .spyOn(userUsecases, 'getAvatarUrl')
        .mockResolvedValueOnce('avatar-url');

      const result = await service.getItemSharedWith(
        user,
        workspace.id,
        itemId,
        itemType,
      );

      expect(result.usersWithRoles[1]).toMatchObject({
        uuid: user.uuid,
        role: {
          id: 'NONE',
          name: 'OWNER',
          createdAt: file.createdAt,
          updatedAt: file.createdAt,
        },
      });
    });

    it('When user is invited, then it should return shared info', async () => {
      const invitedUser = newUser();
      const file = newFile();
      const workspaceFile = newWorkspaceItemUser({
        itemId: file.uuid,
        itemType: WorkspaceItemType.File,
      });
      const role = newRole();
      const sharing = newSharing({
        item: file,
      });
      sharing.sharedWith = invitedUser.uuid;

      jest.spyOn(fileUseCases, 'getByUuid').mockResolvedValueOnce(file);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValueOnce(workspaceFile);
      jest
        .spyOn(sharingUseCases, 'findSharingsWithRolesByItem')
        .mockResolvedValueOnce([{ ...sharing, role }]);
      jest
        .spyOn(service, 'getWorkspaceTeamsUserBelongsTo')
        .mockResolvedValueOnce([]);
      jest
        .spyOn(userUsecases, 'findByUuids')
        .mockResolvedValueOnce([invitedUser, user]);
      jest
        .spyOn(userUsecases, 'getAvatarUrl')
        .mockResolvedValueOnce('avatar-url');

      const result = await service.getItemSharedWith(
        invitedUser,
        workspace.id,
        itemId,
        itemType,
      );

      expect(result.usersWithRoles[0]).toMatchObject({
        sharingId: sharing.id,
        role: role,
      });
    });

    it('When user belongs to a shared team, then it should return shared info', async () => {
      const userAsignedToTeam = newUser();
      const invitedTeam = newWorkspaceTeam();
      const file = newFile();
      const workspaceFile = newWorkspaceItemUser({
        itemId: file.uuid,
        itemType: WorkspaceItemType.File,
      });
      const role = newRole();
      const sharing = newSharing({
        item: file,
      });
      sharing.sharedWith = invitedTeam.id;
      sharing.sharedWithType = SharedWithType.WorkspaceTeam;

      jest.spyOn(fileUseCases, 'getByUuid').mockResolvedValueOnce(file);
      jest
        .spyOn(workspaceRepository, 'getItemBy')
        .mockResolvedValueOnce(workspaceFile);
      jest
        .spyOn(sharingUseCases, 'findSharingsWithRolesByItem')
        .mockResolvedValueOnce([{ ...sharing, role }]);
      jest
        .spyOn(service, 'getWorkspaceTeamsUserBelongsTo')
        .mockResolvedValueOnce([invitedTeam]);

      const result = await service.getItemSharedWith(
        userAsignedToTeam,
        workspace.id,
        itemId,
        itemType,
      );

      expect(result.teamsWithRoles[0]).toMatchObject({
        sharingId: sharing.id,
        role: role,
      });
    });
  });

  describe('searchWorkspaceContent', () => {
    it('when workspace is not found, then it should throw', async () => {
      const user = newUser();
      const workspaceId = v4();
      const query = 'query';

      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(null);

      await expect(
        service.searchWorkspaceContent(user, workspaceId, query, 0),
      ).rejects.toThrow(NotFoundException);
    });

    it('When workspace is found, then it should search for content', async () => {
      const user = newUser();
      const workspace = newWorkspace({ owner: user });
      const query = 'query';
      const files = [newFile()];

      const searchResult: FuzzySearchResult[] = [
        {
          id: v4(),
          itemId: files[0].uuid,
          itemType: WorkspaceItemType.File,
          name: files[0].name,
          similarity: 0.8,
          rank: 1,
        },
      ];

      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(workspace);
      jest
        .spyOn(fuzzySearchUseCases, 'workspaceFuzzySearch')
        .mockResolvedValue(searchResult);

      const result = await service.searchWorkspaceContent(
        user,
        workspace.id,
        query,
        0,
      );

      expect(result[0]).toMatchObject({
        name: files[0].name,
        similarity: 0.8,
      });
    });
  });

  describe('getPersonalWorkspaceFilesInWorkspaceUpdatedAfter', () => {
    const userUuid = v4();
    const workspaceId = v4();
    const updatedAfter = new Date();
    const bucket = 'bucket-name';
    const options = {
      sort: 'plainName',
      order: 'ASC',
      limit: 10,
      offset: 0,
      status: 'EXISTS',
    };

    it('When files are found, then it should return those files', async () => {
      const files = [newFile(), newFile()];
      jest
        .spyOn(fileUseCases, 'getWorkspaceFilesUpdatedAfter')
        .mockResolvedValue(files);

      const result =
        await service.getPersonalWorkspaceFilesInWorkspaceUpdatedAfter(
          userUuid,
          workspaceId,
          updatedAfter,
          options as any,
          bucket,
        );

      expect(result).toEqual(files);
    });

    it('When no options are provided, it should use default values', async () => {
      await service.getPersonalWorkspaceFilesInWorkspaceUpdatedAfter(
        userUuid,
        workspaceId,
        updatedAfter,
      );

      expect(fileUseCases.getWorkspaceFilesUpdatedAfter).toHaveBeenCalledWith(
        userUuid,
        workspaceId,
        updatedAfter,
        {},
        {
          limit: 50,
          offset: 0,
        },
      );
    });

    it('When bucket is provided, it should filter using it', async () => {
      const files = [newFile()];
      jest
        .spyOn(fileUseCases, 'getWorkspaceFilesUpdatedAfter')
        .mockResolvedValue(files);

      const result =
        await service.getPersonalWorkspaceFilesInWorkspaceUpdatedAfter(
          userUuid,
          workspaceId,
          updatedAfter,
          options as any,
          bucket,
        );

      expect(result).toEqual(files);
      expect(fileUseCases.getWorkspaceFilesUpdatedAfter).toHaveBeenCalledWith(
        userUuid,
        workspaceId,
        updatedAfter,
        { status: 'EXISTS', bucket },
        {
          limit: options.limit,
          offset: options.offset,
          sort: [['plainName', 'ASC']],
        },
      );
    });

    it('When no status is provided, then the status condition should be omited', async () => {
      await service.getPersonalWorkspaceFilesInWorkspaceUpdatedAfter(
        userUuid,
        workspaceId,
        updatedAfter,
        { ...options, status: undefined } as any,
        bucket,
      );

      expect(fileUseCases.getWorkspaceFilesUpdatedAfter).toHaveBeenCalledWith(
        userUuid,
        workspaceId,
        updatedAfter,
        { bucket },
        {
          limit: options.limit,
          offset: options.offset,
          sort: [['plainName', 'ASC']],
        },
      );
    });
  });

  describe('getPersonalWorkspaceFoldersInWorkspaceUpdatedAfter', () => {
    const userUuid = v4();
    const workspaceId = v4();
    const updatedAfter = new Date();
    const options = {
      sort: 'plainName',
      order: 'ASC',
      limit: 10,
      offset: 0,
      status: FolderStatus.EXISTS,
    };

    it('When folders are found, then it should return those folders', async () => {
      const folders = [newFolder(), newFolder()];
      jest
        .spyOn(folderUseCases, 'getWorkspacesFoldersUpdatedAfter')
        .mockResolvedValue(folders);

      const result =
        await service.getPersonalWorkspaceFoldersInWorkspaceUpdatedAfter(
          userUuid,
          workspaceId,
          updatedAfter,
          options as any,
        );

      expect(result).toEqual(folders);
      expect(
        folderUseCases.getWorkspacesFoldersUpdatedAfter,
      ).toHaveBeenCalledWith(
        userUuid,
        workspaceId,
        { deleted: false, removed: false },
        updatedAfter,
        {
          limit: options.limit,
          offset: options.offset,
          sort: [['plainName', 'ASC']],
        },
      );
    });

    it('When no options are provided, it should use default values', async () => {
      jest.spyOn(folderUseCases, 'getWorkspacesFoldersUpdatedAfter');

      await service.getPersonalWorkspaceFoldersInWorkspaceUpdatedAfter(
        userUuid,
        workspaceId,
        updatedAfter,
      );

      expect(
        folderUseCases.getWorkspacesFoldersUpdatedAfter,
      ).toHaveBeenCalledWith(userUuid, workspaceId, {}, updatedAfter, {
        limit: 50,
        offset: 0,
      });
    });

    it('When status is provided, it should filter using the correct folder status', async () => {
      jest.spyOn(folderUseCases, 'getWorkspacesFoldersUpdatedAfter');

      await service.getPersonalWorkspaceFoldersInWorkspaceUpdatedAfter(
        userUuid,
        workspaceId,
        updatedAfter,
        options as any,
      );

      expect(
        folderUseCases.getWorkspacesFoldersUpdatedAfter,
      ).toHaveBeenCalledWith(
        userUuid,
        workspaceId,
        { deleted: false, removed: false },
        updatedAfter,
        {
          limit: options.limit,
          offset: options.offset,
          sort: [['plainName', 'ASC']],
        },
      );
    });

    it('When no status is provided, it should omit the status condition', async () => {
      jest.spyOn(folderUseCases, 'getWorkspacesFoldersUpdatedAfter');

      await service.getPersonalWorkspaceFoldersInWorkspaceUpdatedAfter(
        userUuid,
        workspaceId,
        updatedAfter,
        { ...options, status: undefined } as any,
      );

      expect(
        folderUseCases.getWorkspacesFoldersUpdatedAfter,
      ).toHaveBeenCalledWith(userUuid, workspaceId, {}, updatedAfter, {
        limit: options.limit,
        offset: options.offset,
        sort: [['plainName', 'ASC']],
      });
    });

    it('When sort and order are not provided, it should not include sorting options', async () => {
      jest.spyOn(folderUseCases, 'getWorkspacesFoldersUpdatedAfter');

      await service.getPersonalWorkspaceFoldersInWorkspaceUpdatedAfter(
        userUuid,
        workspaceId,
        updatedAfter,
        { ...options, sort: undefined, order: undefined },
      );

      expect(
        folderUseCases.getWorkspacesFoldersUpdatedAfter,
      ).toHaveBeenCalledWith(
        userUuid,
        workspaceId,
        { deleted: false, removed: false },
        updatedAfter,
        {
          limit: options.limit,
          offset: options.offset,
        },
      );
    });
  });

  describe('accessLogs', () => {
    const workspaceId = v4();
    const mockWorkspace = newWorkspace({ attributes: { id: workspaceId } });
    const user = newUser({ attributes: { email: 'test@example.com' } });
    const pagination = { limit: 10, offset: 0 };
    const member = undefined;
    const mockMembersUuids: string[] = undefined;
    const logType: WorkspaceLog['type'][] = [
      WorkspaceLogType.Login,
      WorkspaceLogType.Logout,
    ];
    const lastDays = 7;
    const order: [string, string][] = [['createdAt', 'DESC']];
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

    it('when workspace exists, then should return access logs', async () => {
      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValue(mockWorkspace);
      jest.spyOn(workspaceRepository, 'accessLogs').mockResolvedValue(mockLogs);

      const result = await service.accessLogs(
        workspaceId,
        pagination,
        member,
        logType,
        lastDays,
        summary,
        order,
      );

      expect(result).toEqual(mockLogs);
      expect(workspaceRepository.findById).toHaveBeenCalledWith(workspaceId);
      expect(workspaceRepository.accessLogs).toHaveBeenCalledWith(
        mockWorkspace.id,
        summary,
        mockMembersUuids,
        logType,
        pagination,
        lastDays,
        order,
      );
    });

    it('when workspace does not exist, then should throw NotFoundException', async () => {
      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(null);

      await expect(
        service.accessLogs(
          workspaceId,
          pagination,
          member,
          logType,
          lastDays,
          summary,
          order,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.accessLogs(
          workspaceId,
          pagination,
          member,
          logType,
          lastDays,
          summary,
          order,
        ),
      ).rejects.toThrow('Workspace not found');
    });

    it('when member exist, then should return members logs', async () => {
      const member = 'jhon@doe.com';
      const mockMembers = [newWorkspaceUser()];
      const mockMembersUuids = mockMembers.map((m) => m.memberId);

      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValue(mockWorkspace);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsers')
        .mockResolvedValue(mockMembers);
      jest.spyOn(workspaceRepository, 'accessLogs').mockResolvedValue(mockLogs);

      const result = await service.accessLogs(
        workspaceId,
        pagination,
        member,
        logType,
        lastDays,
        summary,
        order,
      );

      expect(result).toEqual(mockLogs);
      expect(workspaceRepository.findById).toHaveBeenCalledWith(workspaceId);
      expect(workspaceRepository.accessLogs).toHaveBeenCalledWith(
        mockWorkspace.id,
        summary,
        mockMembersUuids,
        logType,
        pagination,
        lastDays,
        order,
      );
    });

    it('when pagination is not provided, then should use default values', async () => {
      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValue(mockWorkspace);
      jest.spyOn(workspaceRepository, 'accessLogs').mockResolvedValue(mockLogs);

      const result = await service.accessLogs(
        workspaceId,
        {},
        member,
        logType,
        lastDays,
        summary,
        order,
      );

      expect(result).toEqual(mockLogs);
      expect(workspaceRepository.findById).toHaveBeenCalledWith(workspaceId);
      expect(workspaceRepository.accessLogs).toHaveBeenCalledWith(
        mockWorkspace.id,
        true,
        mockMembersUuids,
        logType,
        {},
        lastDays,
        order,
      );
    });

    it('when lastDays is not provided, then should call accessLogs without lastDays', async () => {
      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValue(mockWorkspace);
      jest.spyOn(workspaceRepository, 'accessLogs').mockResolvedValue(mockLogs);

      const result = await service.accessLogs(
        workspaceId,
        pagination,
        member,
        logType,
        undefined,
        summary,
        order,
      );

      expect(result).toEqual(mockLogs);
      expect(workspaceRepository.accessLogs).toHaveBeenCalledWith(
        mockWorkspace.id,
        summary,
        mockMembersUuids,
        logType,
        pagination,
        undefined,
        order,
      );
    });

    it('when order is not provided, then should call accessLogs without order', async () => {
      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValue(mockWorkspace);
      jest.spyOn(workspaceRepository, 'accessLogs').mockResolvedValue(mockLogs);

      const result = await service.accessLogs(
        workspaceId,
        pagination,
        member,
        logType,
        lastDays,
        summary,
      );

      expect(result).toEqual(mockLogs);
      expect(workspaceRepository.accessLogs).toHaveBeenCalledWith(
        mockWorkspace.id,
        summary,
        mockMembersUuids,
        logType,
        pagination,
        lastDays,
        undefined,
      );
    });
  });

  describe('getWorkspaceItemAncestors', () => {
    it('When workspace is not found then throws NotFoundException', async () => {
      const workspaceId = 'invalid-workspace-id';
      const itemType = WorkspaceItemType.File;
      const itemUuid = v4();

      jest.spyOn(workspaceRepository, 'findById').mockResolvedValue(null);

      await expect(
        service.getWorkspaceItemAncestors(workspaceId, itemType, itemUuid),
      ).rejects.toThrow(NotFoundException);
    });

    it('When itemType is File and file does not have a folderUuid then throws NotFoundException', async () => {
      const workspaceId = v4();
      const mockWorkspace = newWorkspace({ attributes: { id: workspaceId } });
      const mockFile = newFile({ attributes: { folderUuid: null } });
      const itemType = WorkspaceItemType.File;
      const itemUuid = v4();

      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValue(mockWorkspace);
      jest.spyOn(fileUseCases, 'getByUuid').mockResolvedValue(mockFile);

      await expect(
        service.getWorkspaceItemAncestors(workspaceId, itemType, itemUuid),
      ).rejects.toThrow(NotFoundException);
    });

    it('When itemType is File then returns folder ancestors in workspace', async () => {
      const workspaceId = v4();
      const mockWorkspace = newWorkspace({ attributes: { id: workspaceId } });
      const itemUuid = v4();
      const itemType = WorkspaceItemType.File;
      const mockFile = newFile({ attributes: { folderUuid: itemUuid } });
      const owner = newUser();
      const expectedAncestors = [{ uuid: v4() }, { uuid: v4() }] as any;

      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValue(mockWorkspace);
      jest.spyOn(fileUseCases, 'getByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(service, 'findWorkspaceResourceOwner')
        .mockResolvedValue(owner);
      jest
        .spyOn(folderUseCases, 'getFolderAncestorsInWorkspace')
        .mockResolvedValue(expectedAncestors);

      const result = await service.getWorkspaceItemAncestors(
        workspaceId,
        itemType,
        itemUuid,
      );

      expect(folderUseCases.getFolderAncestorsInWorkspace).toHaveBeenCalledWith(
        owner,
        itemUuid,
      );
      expect(result).toEqual(expectedAncestors);
    });

    it('When itemType is Folder then returns folder ancestors in workspace', async () => {
      const workspaceId = v4();
      const mockWorkspace = newWorkspace({ attributes: { id: workspaceId } });
      const itemType = WorkspaceItemType.Folder;
      const itemUuid = v4();
      const owner = newUser();
      const expectedAncestors = [{ uuid: v4() }, { uuid: v4() }] as any;

      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValue(mockWorkspace);
      jest
        .spyOn(service, 'findWorkspaceResourceOwner')
        .mockResolvedValue(owner);
      jest
        .spyOn(folderUseCases, 'getFolderAncestorsInWorkspace')
        .mockResolvedValue(expectedAncestors);

      const result = await service.getWorkspaceItemAncestors(
        workspaceId,
        itemType,
        itemUuid,
      );

      expect(folderUseCases.getFolderAncestorsInWorkspace).toHaveBeenCalledWith(
        owner,
        itemUuid,
      );
      expect(result).toEqual(expectedAncestors);
    });
  });

  describe('findUserInWorkspace', () => {
    const user = newUser();
    const workspace = newWorkspace();
    const workspaceUser = newWorkspaceUser({
      workspaceId: workspace.id,
      memberId: user.uuid,
      member: user,
    });

    it('When user exists in workspace, then it should return the workspace user', async () => {
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(workspaceUser);

      const result = await service.findUserInWorkspace(user.uuid, workspace.id);

      expect(result).toEqual(workspaceUser);
      expect(workspaceRepository.findWorkspaceUser).toHaveBeenCalledWith(
        {
          workspaceId: workspace.id,
          memberId: user.uuid,
        },
        false,
      );
    });

    it('When user does not exist in workspace, then it should return null', async () => {
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(null);

      const result = await service.findUserInWorkspace(user.uuid, workspace.id);

      expect(result).toBeNull();
      expect(workspaceRepository.findWorkspaceUser).toHaveBeenCalledWith(
        {
          workspaceId: workspace.id,
          memberId: user.uuid,
        },
        false,
      );
    });

    it('When includeUser is true, then it should return workspace user with user data', async () => {
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(workspaceUser);

      const result = await service.findUserInWorkspace(
        user.uuid,
        workspace.id,
        true,
      );

      expect(result).toEqual(workspaceUser);
      expect(workspaceRepository.findWorkspaceUser).toHaveBeenCalledWith(
        {
          workspaceId: workspace.id,
          memberId: user.uuid,
        },
        true,
      );
    });

    it('When includeUser is false, then it should return workspace user without user data', async () => {
      const workspaceUserWithoutMember = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user.uuid,
      });

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUser')
        .mockResolvedValueOnce(workspaceUserWithoutMember);

      const result = await service.findUserInWorkspace(
        user.uuid,
        workspace.id,
        false,
      );

      expect(result).toEqual(workspaceUserWithoutMember);
      expect(workspaceRepository.findWorkspaceUser).toHaveBeenCalledWith(
        {
          workspaceId: workspace.id,
          memberId: user.uuid,
        },
        false,
      );
    });
  });

  describe('removeUserFromNonOwnedWorkspaces', () => {
    const user = newUser();

    it('When user owns no workspaces, then it should remove user from all workspaces', async () => {
      jest.spyOn(workspaceRepository, 'findByOwner').mockResolvedValueOnce([]);

      const memberships = [newWorkspaceUser(), newWorkspaceUser()];
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsersByUserUuid')
        .mockResolvedValueOnce(memberships);

      const leaveWorkspaceSpy = jest
        .spyOn(service, 'leaveWorkspace')
        .mockResolvedValue(undefined);

      await service.removeUserFromNonOwnedWorkspaces(user);

      expect(leaveWorkspaceSpy).toHaveBeenCalledTimes(2);
      expect(leaveWorkspaceSpy).toHaveBeenCalledWith(
        memberships[0].workspaceId,
        user,
      );
      expect(leaveWorkspaceSpy).toHaveBeenCalledWith(
        memberships[1].workspaceId,
        user,
      );
    });

    it('When user owns some workspaces, then it should only remove user from non-owned workspaces', async () => {
      const ownedWorkspaces = [newWorkspace(), newWorkspace()];
      const nonOwnedWorkspacesIds = [v4(), v4()];

      jest
        .spyOn(workspaceRepository, 'findByOwner')
        .mockResolvedValueOnce(ownedWorkspaces);

      const memberships = [
        newWorkspaceUser({ workspaceId: ownedWorkspaces[0].id }),
        newWorkspaceUser({ workspaceId: ownedWorkspaces[1].id }),
        newWorkspaceUser({ workspaceId: nonOwnedWorkspacesIds[0] }),
        newWorkspaceUser({ workspaceId: nonOwnedWorkspacesIds[1] }),
      ];
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsersByUserUuid')
        .mockResolvedValueOnce(memberships);

      const leaveWorkspaceSpy = jest
        .spyOn(service, 'leaveWorkspace')
        .mockResolvedValue(undefined);

      await service.removeUserFromNonOwnedWorkspaces(user);

      expect(leaveWorkspaceSpy).toHaveBeenCalledTimes(2);
      expect(leaveWorkspaceSpy).toHaveBeenCalledWith(
        nonOwnedWorkspacesIds[0],
        user,
      );
      expect(leaveWorkspaceSpy).toHaveBeenCalledWith(
        nonOwnedWorkspacesIds[1],
        user,
      );
    });

    it('When user has no workspace memberships, then it should not call leaveWorkspace', async () => {
      jest.spyOn(workspaceRepository, 'findByOwner').mockResolvedValueOnce([]);

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsersByUserUuid')
        .mockResolvedValueOnce([]);
      const leaveWorkspaceSpy = jest.spyOn(service, 'leaveWorkspace');

      await service.removeUserFromNonOwnedWorkspaces(user);

      expect(leaveWorkspaceSpy).not.toHaveBeenCalled();
    });
  });

  describe('resetWorkspace', () => {
    it('When called, then it should reset the workspace by removing all non-owner members and completely reinitializing', async () => {
      const workspaceNetworkUserId = v4();
      const workspaceOwnerId = v4();
      const workspaceNetworkUser = newUser({
        attributes: { uuid: workspaceNetworkUserId },
      });
      const workspaceOwnerUser = newUser({
        attributes: { uuid: workspaceOwnerId },
      });
      const workspace = newWorkspace({
        attributes: {
          workspaceUserId: workspaceNetworkUserId,
          ownerId: workspaceOwnerId,
          numberOfSeats: 10,
          phoneNumber: '+1234567890',
          address: '123 Test St',
        },
      });

      jest
        .spyOn(userRepository, 'findByUuid')
        .mockResolvedValueOnce(workspaceNetworkUser)
        .mockResolvedValueOnce(workspaceOwnerUser);

      const ownerMember = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: workspaceOwnerId,
      });
      const nonOwnerMembers = Array.from({ length: 2 }, () =>
        newWorkspaceUser({
          workspaceId: workspace.id,
        }),
      );

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsers')
        .mockResolvedValueOnce([ownerMember, ...nonOwnerMembers]);

      const deleteFoldersSpy = jest
        .spyOn(folderUseCases, 'deleteByUuids')
        .mockResolvedValueOnce(undefined);

      const deleteUsersSpy = jest
        .spyOn(workspaceRepository, 'deleteUsersFromWorkspace')
        .mockResolvedValueOnce(undefined);

      const totalSpace = 5000000;
      jest
        .spyOn(service, 'getWorkspaceNetworkLimit')
        .mockResolvedValueOnce(totalSpace);

      const deleteInvitationsSpy = jest
        .spyOn(workspaceRepository, 'deleteAllInvitationsByWorkspace')
        .mockResolvedValueOnce(undefined);

      const deleteWorkspaceContentSpy = jest
        .spyOn(service, 'deleteWorkspaceContent')
        .mockResolvedValueOnce([]);

      const initiateWorkspaceSpy = jest
        .spyOn(service, 'initiateWorkspace')
        .mockResolvedValueOnce({ workspace });

      await service.resetWorkspace(workspace);

      expect(deleteFoldersSpy).toHaveBeenCalledWith(
        workspaceNetworkUser,
        expect.arrayContaining([
          nonOwnerMembers[0].rootFolderId,
          nonOwnerMembers[1].rootFolderId,
        ]),
      );

      expect(deleteUsersSpy).toHaveBeenCalledWith(
        workspace.id,
        expect.arrayContaining([
          ownerMember.memberId,
          nonOwnerMembers[0].memberId,
          nonOwnerMembers[1].memberId,
        ]),
      );

      expect(deleteInvitationsSpy).toHaveBeenCalledWith(workspace.id);
      expect(deleteWorkspaceContentSpy).toHaveBeenCalledWith(
        workspace.id,
        workspaceOwnerUser,
      );
      expect(initiateWorkspaceSpy).toHaveBeenCalledWith(
        workspace.ownerId,
        totalSpace,
        {
          numberOfSeats: workspace.numberOfSeats,
          phoneNumber: workspace.phoneNumber,
          address: workspace.address,
        },
      );
    });

    it('When workspace has only the owner as member, then it should still completely reset the workspace', async () => {
      const workspaceNetworkUserId = v4();
      const workspaceOwnerId = v4();
      const workspaceNetworkUser = newUser({
        attributes: { uuid: workspaceNetworkUserId },
      });
      const workspaceOwnerUser = newUser({
        attributes: { uuid: workspaceOwnerId },
      });
      const workspace = newWorkspace({
        attributes: {
          workspaceUserId: workspaceNetworkUserId,
          ownerId: workspaceOwnerId,
          numberOfSeats: 5,
        },
      });

      jest
        .spyOn(userRepository, 'findByUuid')
        .mockResolvedValueOnce(workspaceNetworkUser)
        .mockResolvedValueOnce(workspaceOwnerUser);

      const ownerMember = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: workspaceOwnerId,
      });

      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsers')
        .mockResolvedValueOnce([ownerMember]);

      const deleteFoldersSpy = jest
        .spyOn(folderUseCases, 'deleteByUuids')
        .mockResolvedValueOnce(undefined);

      const deleteUsersSpy = jest
        .spyOn(workspaceRepository, 'deleteUsersFromWorkspace')
        .mockResolvedValueOnce(undefined);

      const totalSpace = 3000000;
      jest
        .spyOn(service, 'getWorkspaceNetworkLimit')
        .mockResolvedValueOnce(totalSpace);

      const deleteInvitationsSpy = jest
        .spyOn(workspaceRepository, 'deleteAllInvitationsByWorkspace')
        .mockResolvedValueOnce(undefined);

      const deleteWorkspaceContentSpy = jest
        .spyOn(service, 'deleteWorkspaceContent')
        .mockResolvedValueOnce([]);

      const initiateWorkspaceSpy = jest
        .spyOn(service, 'initiateWorkspace')
        .mockResolvedValueOnce({ workspace });

      await service.resetWorkspace(workspace);

      expect(deleteFoldersSpy).toHaveBeenCalledWith(workspaceNetworkUser, []);
      expect(deleteUsersSpy).toHaveBeenCalledWith(workspace.id, [
        ownerMember.memberId,
      ]);
      expect(deleteInvitationsSpy).toHaveBeenCalledWith(workspace.id);
      expect(deleteWorkspaceContentSpy).toHaveBeenCalledWith(
        workspace.id,
        workspaceOwnerUser,
      );
      expect(initiateWorkspaceSpy).toHaveBeenCalledWith(
        workspace.ownerId,
        totalSpace,
        {
          numberOfSeats: workspace.numberOfSeats,
          phoneNumber: workspace.phoneNumber,
          address: workspace.address,
        },
      );
    });
  });

  describe('emptyAllUserOwnedWorkspaces', () => {
    it('When user owns multiple workspaces, it should reset all of them', async () => {
      const user = newUser();
      const ownedWorkspaces = Array.from({ length: 3 }, () =>
        newWorkspace({ owner: user }),
      );

      jest
        .spyOn(workspaceRepository, 'findByOwner')
        .mockResolvedValueOnce(ownedWorkspaces);

      const resetWorkspaceSpy = jest
        .spyOn(service, 'resetWorkspace')
        .mockResolvedValue(undefined);

      await service.emptyAllUserOwnedWorkspaces(user);

      expect(resetWorkspaceSpy).toHaveBeenCalledTimes(3);
      expect(resetWorkspaceSpy).toHaveBeenCalledWith(ownedWorkspaces[0]);
      expect(resetWorkspaceSpy).toHaveBeenCalledWith(ownedWorkspaces[1]);
      expect(resetWorkspaceSpy).toHaveBeenCalledWith(ownedWorkspaces[2]);
    });
  });
});
