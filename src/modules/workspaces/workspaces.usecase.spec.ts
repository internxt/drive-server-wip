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
  newWorkspaceUser,
} from '../../../test/fixtures';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PreCreatedUser } from '../user/pre-created-user.domain';
import { BridgeService } from '../../externals/bridge/bridge.service';

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
  let userRepository: SequelizeUserRepository;
  let userUsecases: UserUseCases;
  let mailerService: MailerService;
  let networkService: BridgeService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkspacesUsecases],
    })
      .useMocker(() => createMock())
      .compile();

    service = module.get<WorkspacesUsecases>(WorkspacesUsecases);
    workspaceRepository = module.get<SequelizeWorkspaceRepository>(
      SequelizeWorkspaceRepository,
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

    it('When workspace has no more slots left, then it should throw', async () => {
      const workspace = newWorkspace();
      const user = newUser();

      jest
        .spyOn(workspaceRepository, 'findById')
        .mockResolvedValueOnce(workspace);
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
    it('When workspace has slots left, then workspace is full', async () => {
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

    it('When there is no space left, then it should return 0', async () => {
      jest.spyOn(networkService, 'getLimit').mockResolvedValue(700000);
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
      expect(assignableSpace).toBe(BigInt(0));
    });
  });
});
