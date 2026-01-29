import { Test, TestingModule } from '@nestjs/testing';
import { SequelizeUserRepository } from '../user/user.repository';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { WorkspacesUsecases } from '../workspaces/workspaces.usecase';
import {
  newUser,
  newWorkspace,
  newWorkspaceTeam,
  newWorkspaceUser,
  newTier,
  newFolder,
  newFeatureLimit,
  newVersioningLimits,
} from '../../../test/fixtures';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { v4 } from 'uuid';
import { GatewayUseCases } from './gateway.usecase';
import { InitializeWorkspaceDto } from './dto/initialize-workspace.dto';
import { UserUseCases } from '../user/user.usecase';
import { CacheManagerService } from '../cache-manager/cache-manager.service';
import { StorageNotificationService } from '../../externals/notifications/storage.notifications.service';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { MailerService } from '../../externals/mailer/mailer.service';
import { ConfigService } from '@nestjs/config';
import { SequelizeFolderRepository } from '../folder/folder.repository';
import { SequelizeFeatureLimitsRepository } from '../feature-limit/feature-limit.repository';
import { LimitTypes, LimitLabels } from '../feature-limit/limits.enum';
import { FileUseCases } from '../file/file.usecase';

describe('GatewayUseCases', () => {
  let service: GatewayUseCases;
  let userRepository: SequelizeUserRepository;
  let userUseCases: UserUseCases;
  let workspaceUseCases: WorkspacesUsecases;
  let cacheManagerService: CacheManagerService;
  let loggerMock: DeepMocked<Logger>;
  let storageNotificationService: StorageNotificationService;
  let featureLimitService: FeatureLimitService;
  let fileUseCases: FileUseCases;
  let mailerService: MailerService;
  let configService: ConfigService;
  let folderRepository: SequelizeFolderRepository;
  let limitsRepository: SequelizeFeatureLimitsRepository;
  beforeEach(async () => {
    loggerMock = createMock<Logger>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GatewayUseCases],
    })
      .setLogger(loggerMock)
      .useMocker(createMock)
      .compile();

    service = module.get<GatewayUseCases>(GatewayUseCases);
    userRepository = module.get<SequelizeUserRepository>(
      SequelizeUserRepository,
    );
    userUseCases = module.get<UserUseCases>(UserUseCases);
    workspaceUseCases = module.get<WorkspacesUsecases>(WorkspacesUsecases);
    cacheManagerService = module.get(CacheManagerService);
    storageNotificationService = module.get<StorageNotificationService>(
      StorageNotificationService,
    );
    featureLimitService = module.get<FeatureLimitService>(FeatureLimitService);
    fileUseCases = module.get<FileUseCases>(FileUseCases);
    mailerService = module.get<MailerService>(MailerService);
    configService = module.get<ConfigService>(ConfigService);
    folderRepository = module.get<SequelizeFolderRepository>(
      SequelizeFolderRepository,
    );
    limitsRepository = module.get<SequelizeFeatureLimitsRepository>(
      SequelizeFeatureLimitsRepository,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeWorkspace', () => {
    const owner = newUser();
    const maxSpaceBytes = 1000000;
    const workspaceAddress = '123 Main St';
    const workspacePhoneNumber = '+1 (123) 456-7890';

    it('When owner does not exist, then it should throw', async () => {
      jest
        .spyOn(workspaceUseCases, 'initiateWorkspace')
        .mockRejectedValueOnce(new BadRequestException());

      const initializeWorkspaceDto: InitializeWorkspaceDto = {
        ownerId: owner.uuid,
        maxSpaceBytes,
        address: workspaceAddress,
        phoneNumber: workspacePhoneNumber,
        numberOfSeats: 20,
      };

      await expect(
        service.initializeWorkspace(initializeWorkspaceDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('When workspace, default team and root folder are successfully created, then it should return the new workspace', async () => {
      const newDefaultTeam = newWorkspaceTeam();
      const createdWorkspace = newWorkspace({
        owner,
        attributes: {
          defaultTeamId: newDefaultTeam.id,
          address: workspaceAddress,
          phoneNumber: workspacePhoneNumber,
        },
      });
      jest
        .spyOn(workspaceUseCases, 'initiateWorkspace')
        .mockResolvedValueOnce({ workspace: createdWorkspace });
      const initializeWorkspaceDto: InitializeWorkspaceDto = {
        ownerId: owner.uuid,
        maxSpaceBytes,
        address: workspaceAddress,
        phoneNumber: workspacePhoneNumber,
        numberOfSeats: 20,
      };
      await expect(
        service.initializeWorkspace(initializeWorkspaceDto),
      ).resolves.toStrictEqual({ workspace: createdWorkspace });
    });

    it('When tier id is provided and valid, then it should create workspace successfully', async () => {
      const tier = newTier();
      const createdWorkspace = newWorkspace({ owner });
      jest.spyOn(featureLimitService, 'getTier').mockResolvedValueOnce(tier);
      jest
        .spyOn(workspaceUseCases, 'initiateWorkspace')
        .mockResolvedValueOnce({ workspace: createdWorkspace });

      const initializeWorkspaceDto: InitializeWorkspaceDto = {
        ownerId: owner.uuid,
        maxSpaceBytes,
        address: workspaceAddress,
        phoneNumber: workspacePhoneNumber,
        numberOfSeats: 20,
        tierId: tier.id,
      };

      await expect(
        service.initializeWorkspace(initializeWorkspaceDto),
      ).resolves.toEqual({ workspace: createdWorkspace });

      expect(featureLimitService.getTier).toHaveBeenCalledWith(tier.id);
    });

    it('When tier id is provided but invalid, then it should throw BadRequestException', async () => {
      const invalidTierId = v4();
      jest.spyOn(featureLimitService, 'getTier').mockResolvedValueOnce(null);

      const initializeWorkspaceDto: InitializeWorkspaceDto = {
        ownerId: owner.uuid,
        maxSpaceBytes,
        address: workspaceAddress,
        phoneNumber: workspacePhoneNumber,
        numberOfSeats: 20,
        tierId: invalidTierId,
      };

      await expect(
        service.initializeWorkspace(initializeWorkspaceDto),
      ).rejects.toThrow(BadRequestException);

      expect(featureLimitService.getTier).toHaveBeenCalledWith(invalidTierId);
      expect(workspaceUseCases.initiateWorkspace).not.toHaveBeenCalled();
    });

    describe('updateWorkspaceStorage', () => {
      it('When user is not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(null);
        await expect(
          service.updateWorkspaceStorage(v4(), maxSpaceBytes, 4),
        ).rejects.toThrow(BadRequestException);
      });

      it('When the workspace is not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(owner);
        jest.spyOn(workspaceUseCases, 'findOne').mockResolvedValueOnce(null);

        await expect(
          service.updateWorkspaceStorage(owner.uuid, maxSpaceBytes, 4),
        ).rejects.toThrow(NotFoundException);
      });

      it('When owner and workspaces are found, then it should update the workspaces completed', async () => {
        const workspaceUserEmail = 'user@workspace.com';
        const workspaceUser = newUser({
          attributes: {
            email: workspaceUserEmail,
            username: workspaceUserEmail,
            bridgeUser: workspaceUserEmail,
          },
        });
        const numberOfSeats = 4;
        const workspace = newWorkspace({
          owner,
          attributes: {
            ownerId: owner.uuid,
            workspaceUserId: workspaceUser.uuid,
            numberOfSeats,
          },
        });

        jest
          .spyOn(userRepository, 'findByUuid')
          .mockResolvedValueOnce(owner)
          .mockResolvedValueOnce(workspaceUser);

        jest
          .spyOn(workspaceUseCases, 'findOne')
          .mockResolvedValueOnce(workspace);

        await service.updateWorkspaceStorage(
          owner.uuid,
          maxSpaceBytes,
          numberOfSeats,
        );

        expect(workspaceUseCases.updateWorkspaceLimit).toHaveBeenCalledWith(
          workspace.id,
          maxSpaceBytes,
          undefined,
        );
      });

      it('When owner and workspaces are found and a diferent number of seats is received, then it should update the workspaces completed', async () => {
        const workspaceUserEmail = 'user@workspace.com';
        const workspaceUser = newUser({
          attributes: {
            email: workspaceUserEmail,
            username: workspaceUserEmail,
            bridgeUser: workspaceUserEmail,
          },
        });
        const numberOfSeats = 4;
        const workspace = newWorkspace({
          owner,
          attributes: {
            ownerId: owner.uuid,
            workspaceUserId: workspaceUser.uuid,
            numberOfSeats: 3,
          },
        });

        jest
          .spyOn(userRepository, 'findByUuid')
          .mockResolvedValueOnce(owner)
          .mockResolvedValueOnce(workspaceUser);

        jest
          .spyOn(workspaceUseCases, 'findOne')
          .mockResolvedValueOnce(workspace);

        jest
          .spyOn(workspaceUseCases, 'updateWorkspaceMemberCount')
          .mockResolvedValueOnce();

        await service.updateWorkspaceStorage(
          owner.uuid,
          maxSpaceBytes,
          numberOfSeats,
        );

        expect(
          workspaceUseCases.updateWorkspaceMemberCount,
        ).toHaveBeenCalledWith(workspace.id, numberOfSeats);

        expect(workspaceUseCases.updateWorkspaceLimit).toHaveBeenCalledWith(
          workspace.id,
          maxSpaceBytes,
          numberOfSeats,
        );
      });
    });

    describe('validateStorageForPlanChange', () => {
      it('When user is not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(null);
        await expect(
          service.validateStorageForPlanChange(v4(), maxSpaceBytes, 4),
        ).rejects.toThrow(BadRequestException);
      });

      it('When the workspace is not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(owner);
        jest.spyOn(workspaceUseCases, 'findOne').mockResolvedValueOnce(null);

        await expect(
          service.validateStorageForPlanChange(owner.uuid, maxSpaceBytes, 4),
        ).rejects.toThrow(NotFoundException);
      });

      it('When owner and workspaces are found, then it should call validateStorageForPlanChange', async () => {
        const owner = newUser();
        const workspace = newWorkspace({ owner });
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(owner);
        jest
          .spyOn(workspaceUseCases, 'findOne')
          .mockResolvedValueOnce(workspace);

        await service.validateStorageForPlanChange(
          owner.uuid,
          maxSpaceBytes,
          4,
        );

        expect(
          workspaceUseCases.validateStorageForPlanChange,
        ).toHaveBeenCalledWith(workspace, maxSpaceBytes, 4);
      });
    });

    describe('destroyWorkspace', () => {
      it('When owner is not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(null);

        await expect(service.destroyWorkspace(owner.uuid)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('When the workspace is not found, then it should throw', async () => {
        jest.spyOn(workspaceUseCases, 'findOne').mockResolvedValue(null);

        await expect(service.destroyWorkspace(owner.uuid)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('When owner and workspaces are found, then it should delete all workspaces content and send the workspaceLeft notification for all members', async () => {
        const workspace = newWorkspace({
          owner,
          attributes: { ownerId: owner.uuid },
        });
        const workspaceMembers = [
          newWorkspaceUser({
            workspaceId: workspace.id,
            member: newUser(),
          }),
          newWorkspaceUser({
            member: owner,
            workspaceId: workspace.id,
          }),
        ];

        jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(owner);
        jest.spyOn(workspaceUseCases, 'findOne').mockResolvedValue(workspace);
        jest
          .spyOn(workspaceUseCases, 'deleteWorkspaceContent')
          .mockResolvedValue(workspaceMembers);

        await service.destroyWorkspace(owner.uuid);

        expect(workspaceUseCases.deleteWorkspaceContent).toHaveBeenCalledWith(
          workspace.id,
          owner,
        );

        expect(storageNotificationService.workspaceLeft).toHaveBeenCalledTimes(
          2,
        );
        expect(storageNotificationService.workspaceLeft).toHaveBeenCalledWith(
          expect.anything(),
        );
      });
    });
  });

  describe('users', () => {
    describe('getUserByEmail', () => {
      const user = newUser();

      it('When user is not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);

        await expect(service.getUserByEmail(user.email)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('When user exists, then it is returned ', async () => {
        jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(user);

        await expect(service.getUserByEmail(user.email)).resolves.toStrictEqual(
          user,
        );
      });
    });

    describe('getUserCredentials', () => {
      const user = newUser();
      const folder = newFolder();
      const mockTokens = {
        token: 'test-token',
        newToken: 'test-new-token',
      };

      it('When user is not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);

        await expect(service.getUserCredentials(user.email)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('When folder is found, then it includes folder uuid in response', async () => {
        jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(user);
        jest.spyOn(userUseCases, 'getAuthTokens').mockResolvedValue(mockTokens);
        jest.spyOn(folderRepository, 'findById').mockResolvedValue(folder);

        const result = await service.getUserCredentials(user.email);

        expect(result.user.rootFolderId).toBe(folder.uuid);
        expect(folderRepository.findById).toHaveBeenCalledWith(
          user.rootFolderId,
        );
      });

      it('When user is found, then it should return user and tokens', async () => {
        const mockResponse = {
          user: {
            email: user.email,
            userId: user.userId,
            root_folder_id: user.rootFolderId,
            rootFolderId: folder.uuid,
            name: user.name,
            lastname: user.lastname,
            uuid: user.uuid,
            createdAt: user.createdAt,
            tierId: user.tierId,
            registerCompleted: user.registerCompleted,
            username: user.username,
            bridgeUser: user.bridgeUser,
            sharedWorkspace: user.sharedWorkspace,
            backupsBucket: user.backupsBucket,
            emailVerified: user.emailVerified,
            lastPasswordChangedAt: user.lastPasswordChangedAt,
          },
          tokens: { token: 'test-token', newToken: 'test-new-token' },
        };

        jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(user);
        jest.spyOn(userUseCases, 'getAuthTokens').mockResolvedValue(mockTokens);
        jest.spyOn(folderRepository, 'findById').mockResolvedValue(folder);

        const result = await service.getUserCredentials(user.email);

        expect(result).toEqual(mockResponse);
      });
    });

    describe('checkUserStorageExpansion', () => {
      const user = newUser();

      it('When user is not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(null);

        await expect(
          service.checkUserStorageExpansion(user.uuid),
        ).rejects.toThrow(NotFoundException);
      });

      it('When user exists, then it should return storage stackability data', async () => {
        const response = {
          canExpand: true,
          currentMaxSpaceBytes: 10000,
          expandableBytes: 13400,
        };

        jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(user);
        jest
          .spyOn(userUseCases, 'canUserExpandStorage')
          .mockResolvedValue(response);

        await expect(
          service.checkUserStorageExpansion(user.uuid, 100),
        ).resolves.toStrictEqual(response);
      });
    });

    describe('getUserByUuid', () => {
      const user = newUser();

      it('When called, then it should return the user', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(user);

        await expect(service.getUserByUuid(user.uuid)).resolves.toStrictEqual(
          user,
        );
        expect(userRepository.findByUuid).toHaveBeenCalledWith(user.uuid);
      });

      it('When user does not exist, then it should return null', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(null);

        await expect(service.getUserByUuid(user.uuid)).resolves.toBeNull();
        expect(userRepository.findByUuid).toHaveBeenCalledWith(user.uuid);
      });
    });

    describe('updateUser', () => {
      const user = newUser();
      const newStorageSpaceBytes = 5000000;
      const validTier = newTier();

      beforeEach(() => {
        jest
          .spyOn(featureLimitService, 'getFileVersioningLimits')
          .mockResolvedValue(newVersioningLimits({ enabled: false }));

        jest
          .spyOn(fileUseCases, 'undoFileVersioning')
          .mockResolvedValue({ deletedCount: 0 });
      });

      describe('when updating storage without tier', () => {
        it('When updating user storage, then it should update the user storage and keep that new storage limit cached', async () => {
          jest.spyOn(userUseCases, 'updateUserStorage').mockResolvedValue();
          jest.spyOn(cacheManagerService, 'expireLimit').mockResolvedValue();
          jest
            .spyOn(cacheManagerService, 'setUserStorageLimit')
            .mockResolvedValue(undefined);

          await service.updateUser(user, { newStorageSpaceBytes });

          expect(userUseCases.updateUserStorage).toHaveBeenCalledWith(
            user,
            newStorageSpaceBytes,
          );
          expect(cacheManagerService.setUserStorageLimit).toHaveBeenCalledWith(
            user.uuid,
            newStorageSpaceBytes,
            1000 * 60,
          );
        });

        it('When updating user storage and setting storage limit cache succeeds, then it should complete without error', async () => {
          jest.spyOn(userUseCases, 'updateUserStorage').mockResolvedValue();
          jest.spyOn(cacheManagerService, 'expireLimit').mockResolvedValue();
          jest
            .spyOn(cacheManagerService, 'setUserStorageLimit')
            .mockResolvedValue(undefined);

          await expect(
            service.updateUser(user, { newStorageSpaceBytes }),
          ).resolves.not.toThrow();

          expect(userUseCases.updateUserStorage).toHaveBeenCalledWith(
            user,
            newStorageSpaceBytes,
          );
          expect(cacheManagerService.setUserStorageLimit).toHaveBeenCalledWith(
            user.uuid,
            newStorageSpaceBytes,
            1000 * 60,
          );
        });

        it('When updating user storage and setting storage limit cache fails, then it should still complete without error', async () => {
          jest.spyOn(userUseCases, 'updateUserStorage').mockResolvedValue();
          jest.spyOn(cacheManagerService, 'expireLimit').mockResolvedValue();
          jest
            .spyOn(cacheManagerService, 'setUserStorageLimit')
            .mockRejectedValue(new Error('Cache set error'));

          await expect(
            service.updateUser(user, { newStorageSpaceBytes }),
          ).resolves.not.toThrow();

          expect(userUseCases.updateUserStorage).toHaveBeenCalledWith(
            user,
            newStorageSpaceBytes,
          );
          expect(cacheManagerService.setUserStorageLimit).toHaveBeenCalledWith(
            user.uuid,
            newStorageSpaceBytes,
            1000 * 60,
          );
        });

        it('When updating user and new storage space is not set, then it should not try to update the storage', async () => {
          await expect(
            service.updateUser(user, { newStorageSpaceBytes: undefined }),
          ).resolves.not.toThrow();

          expect(userUseCases.updateUserStorage).not.toHaveBeenCalled();
        });

        it('When updating user storage fails, then it should throw the error', async () => {
          const error = new Error('Failed to update user storage');
          jest
            .spyOn(userUseCases, 'updateUserStorage')
            .mockRejectedValue(error);

          await expect(
            service.updateUser(user, { newStorageSpaceBytes }),
          ).rejects.toThrow(error);

          expect(userUseCases.updateUserStorage).toHaveBeenCalledWith(
            user,
            newStorageSpaceBytes,
          );
        });
      });

      describe('when updating with tier', () => {
        it('When tier exists and is different from user tier, then it should validate tier, update user tier and storage', async () => {
          const differentTierId = v4();
          jest
            .spyOn(featureLimitService, 'getTier')
            .mockResolvedValue(validTier);
          jest.spyOn(userRepository, 'updateBy').mockResolvedValue(undefined);
          jest.spyOn(userUseCases, 'updateUserStorage').mockResolvedValue();
          jest.spyOn(cacheManagerService, 'expireLimit').mockResolvedValue();
          jest
            .spyOn(cacheManagerService, 'setUserStorageLimit')
            .mockResolvedValue(undefined);

          await service.updateUser(user, {
            newStorageSpaceBytes,
            newTierId: differentTierId,
          });

          expect(featureLimitService.getTier).toHaveBeenCalledWith(
            differentTierId,
          );
          expect(userRepository.updateBy).toHaveBeenCalledWith(
            { uuid: user.uuid },
            { tierId: differentTierId },
          );
          expect(userUseCases.updateUserStorage).toHaveBeenCalledWith(
            user,
            newStorageSpaceBytes,
          );
        });

        it('When tier exists and is same as user tier, then it should not update user tier but still update storage', async () => {
          jest
            .spyOn(featureLimitService, 'getTier')
            .mockResolvedValue(validTier);
          jest.spyOn(userRepository, 'updateBy').mockResolvedValue(undefined);
          jest.spyOn(userUseCases, 'updateUserStorage').mockResolvedValue();
          jest.spyOn(cacheManagerService, 'expireLimit').mockResolvedValue();
          jest
            .spyOn(cacheManagerService, 'setUserStorageLimit')
            .mockResolvedValue(undefined);

          await service.updateUser(user, {
            newStorageSpaceBytes,
            newTierId: user.tierId,
          });

          expect(featureLimitService.getTier).toHaveBeenCalledWith(user.tierId);
          expect(userRepository.updateBy).not.toHaveBeenCalled();
          expect(userUseCases.updateUserStorage).toHaveBeenCalledWith(
            user,
            newStorageSpaceBytes,
          );
        });

        it('When tier does not exist, then it should throw', async () => {
          const invalidTierId = v4();
          jest.spyOn(featureLimitService, 'getTier').mockResolvedValue(null);

          await expect(
            service.updateUser(user, {
              newStorageSpaceBytes,
              newTierId: invalidTierId,
            }),
          ).rejects.toThrow(BadRequestException);

          expect(featureLimitService.getTier).toHaveBeenCalledWith(
            invalidTierId,
          );
          expect(userRepository.updateBy).not.toHaveBeenCalled();
          expect(userUseCases.updateUserStorage).not.toHaveBeenCalled();
        });

        it('When tier validation succeeds but user tier update fails, then it should throw the error', async () => {
          const differentTierId = v4();
          const updateError = new Error('Failed to update user tier');
          jest
            .spyOn(featureLimitService, 'getTier')
            .mockResolvedValue(validTier);
          jest.spyOn(userRepository, 'updateBy').mockRejectedValue(updateError);

          await expect(
            service.updateUser(user, {
              newStorageSpaceBytes,
              newTierId: differentTierId,
            }),
          ).rejects.toThrow(updateError);

          expect(featureLimitService.getTier).toHaveBeenCalledWith(
            differentTierId,
          );
          expect(userRepository.updateBy).toHaveBeenCalledWith(
            { uuid: user.uuid },
            { tierId: differentTierId },
          );
        });

        it('When tier is updated successfully, then user object should reflect the new tier', async () => {
          const differentTierId = v4();
          const originalTierId = user.tierId;
          jest
            .spyOn(featureLimitService, 'getTier')
            .mockResolvedValue(validTier);
          jest.spyOn(userRepository, 'updateBy').mockResolvedValue(undefined);
          jest.spyOn(userUseCases, 'updateUserStorage').mockResolvedValue();
          jest.spyOn(cacheManagerService, 'expireLimit').mockResolvedValue();
          jest
            .spyOn(cacheManagerService, 'setUserStorageLimit')
            .mockResolvedValue(undefined);

          await service.updateUser(user, {
            newStorageSpaceBytes,
            newTierId: differentTierId,
          });

          expect(user.tierId).toBe(differentTierId);
          expect(user.tierId).not.toBe(originalTierId);
        });

        it('When user has versioning enabled, then should not delete file versions', async () => {
          const enabledLimits = newVersioningLimits({ enabled: true });
          const getLimitsSpy = jest
            .spyOn(featureLimitService, 'getFileVersioningLimits')
            .mockResolvedValue(enabledLimits);
          const undoSpy = jest.spyOn(fileUseCases, 'undoFileVersioning');

          jest.spyOn(userUseCases, 'updateUserStorage').mockResolvedValue();
          jest.spyOn(cacheManagerService, 'expireLimit').mockResolvedValue();
          jest
            .spyOn(cacheManagerService, 'setUserStorageLimit')
            .mockResolvedValue(undefined);

          await service.updateUser(user, { newStorageSpaceBytes });

          expect(getLimitsSpy).toHaveBeenCalledWith(user.uuid);
          expect(undoSpy).not.toHaveBeenCalled();
        });

        it('When user has versioning disabled, then should delete all file versions', async () => {
          const disabledLimits = newVersioningLimits({ enabled: false });
          const getLimitsSpy = jest
            .spyOn(featureLimitService, 'getFileVersioningLimits')
            .mockResolvedValue(disabledLimits);
          const undoSpy = jest
            .spyOn(fileUseCases, 'undoFileVersioning')
            .mockResolvedValue({ deletedCount: 150 });

          jest.spyOn(userUseCases, 'updateUserStorage').mockResolvedValue();
          jest.spyOn(cacheManagerService, 'expireLimit').mockResolvedValue();
          jest
            .spyOn(cacheManagerService, 'setUserStorageLimit')
            .mockResolvedValue(undefined);

          await service.updateUser(user, { newStorageSpaceBytes });

          expect(getLimitsSpy).toHaveBeenCalledWith(user.uuid);
          expect(undoSpy).toHaveBeenCalledWith(user.uuid);
        });

        it('When file versions are deleted, then should log deletion count', async () => {
          const disabledLimits = newVersioningLimits({ enabled: false });
          jest
            .spyOn(featureLimitService, 'getFileVersioningLimits')
            .mockResolvedValue(disabledLimits);
          jest
            .spyOn(fileUseCases, 'undoFileVersioning')
            .mockResolvedValue({ deletedCount: 42 });
          jest.spyOn(userUseCases, 'updateUserStorage').mockResolvedValue();
          jest.spyOn(cacheManagerService, 'expireLimit').mockResolvedValue();
          jest
            .spyOn(cacheManagerService, 'setUserStorageLimit')
            .mockResolvedValue(undefined);

          const logSpy = jest.spyOn(Logger, 'log');

          await service.updateUser(user, { newStorageSpaceBytes });

          const expectedMessage = 'Deleted 42 file versions';
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining(expectedMessage),
          );
        });
      });
    });

    describe('updateWorkspace', () => {
      const owner = newUser();
      const maxSpaceBytes = 10000000;
      const numberOfSeats = 10;
      const validTier = newTier();
      const workspaceEmail = 'workspace@test.com';
      const workspaceUser = newUser({
        attributes: {
          email: workspaceEmail,
          username: workspaceEmail,
          bridgeUser: workspaceEmail,
          tierId: validTier.id,
        },
      });
      const workspace = newWorkspace({
        owner,
        attributes: {
          ownerId: owner.uuid,
          workspaceUserId: workspaceUser.uuid,
          numberOfSeats: 5,
        },
      });

      it('When owner is not found, then it should throw BadRequestException', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(null);

        await expect(
          service.updateWorkspace(v4(), { maxSpaceBytes, numberOfSeats }),
        ).rejects.toThrow(BadRequestException);
      });

      it('When workspace is not found, then it should throw NotFoundException', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(owner);
        jest.spyOn(workspaceUseCases, 'findOne').mockResolvedValueOnce(null);

        await expect(
          service.updateWorkspace(owner.uuid, {
            maxSpaceBytes,
            numberOfSeats,
          }),
        ).rejects.toThrow(NotFoundException);
      });

      it('When workspace user is not found, then it should throw NotFoundException', async () => {
        jest
          .spyOn(userRepository, 'findByUuid')
          .mockResolvedValueOnce(owner)
          .mockResolvedValueOnce(null);
        jest
          .spyOn(workspaceUseCases, 'findOne')
          .mockResolvedValueOnce(workspace);

        await expect(
          service.updateWorkspace(owner.uuid, {
            maxSpaceBytes,
            numberOfSeats,
          }),
        ).rejects.toThrow(NotFoundException);
      });

      it('When tier ID is invalid, then it should throw BadRequestException', async () => {
        const invalidTierId = v4();
        jest
          .spyOn(userRepository, 'findByUuid')
          .mockResolvedValueOnce(owner)
          .mockResolvedValueOnce(workspaceUser);
        jest
          .spyOn(workspaceUseCases, 'findOne')
          .mockResolvedValueOnce(workspace);
        jest.spyOn(featureLimitService, 'getTier').mockResolvedValueOnce(null);

        await expect(
          service.updateWorkspace(owner.uuid, { tierId: invalidTierId }),
        ).rejects.toThrow(BadRequestException);

        expect(featureLimitService.getTier).toHaveBeenCalledWith(invalidTierId);
      });

      it('When update fails, then it should propagate the error', async () => {
        const tierId = v4();
        const updateError = new Error('Failed to update tier');
        jest
          .spyOn(userRepository, 'findByUuid')
          .mockResolvedValueOnce(owner)
          .mockResolvedValueOnce(workspaceUser);
        jest
          .spyOn(workspaceUseCases, 'findOne')
          .mockResolvedValueOnce(workspace);
        jest
          .spyOn(featureLimitService, 'getTier')
          .mockResolvedValueOnce(validTier);
        jest
          .spyOn(userRepository, 'updateBy')
          .mockRejectedValueOnce(updateError);

        await expect(
          service.updateWorkspace(owner.uuid, { tierId }),
        ).rejects.toThrow(updateError);
      });

      describe('when updating tier', () => {
        it('When tier exists and is different from workspace user tier, then it should validate and update tier', async () => {
          const tier = newTier();
          jest
            .spyOn(userRepository, 'findByUuid')
            .mockResolvedValueOnce(owner)
            .mockResolvedValueOnce(workspaceUser);
          jest
            .spyOn(workspaceUseCases, 'findOne')
            .mockResolvedValueOnce(workspace);
          jest
            .spyOn(featureLimitService, 'getTier')
            .mockResolvedValueOnce(tier);
          jest
            .spyOn(userRepository, 'updateBy')
            .mockResolvedValueOnce(undefined);

          await service.updateWorkspace(owner.uuid, {
            tierId: tier.id,
          });

          expect(featureLimitService.getTier).toHaveBeenCalledWith(tier.id);
          expect(userRepository.updateBy).toHaveBeenCalledWith(
            { uuid: workspaceUser.uuid },
            { tierId: tier.id },
          );
        });

        it('When tier exists and is same as workspace user tier, then it should not update tier', async () => {
          jest
            .spyOn(userRepository, 'findByUuid')
            .mockResolvedValueOnce(owner)
            .mockResolvedValueOnce(workspaceUser);
          jest
            .spyOn(workspaceUseCases, 'findOne')
            .mockResolvedValueOnce(workspace);
          jest
            .spyOn(featureLimitService, 'getTier')
            .mockResolvedValueOnce(validTier);
          jest
            .spyOn(userRepository, 'updateBy')
            .mockResolvedValueOnce(undefined);

          await service.updateWorkspace(owner.uuid, {
            tierId: workspaceUser.tierId,
          });

          expect(featureLimitService.getTier).toHaveBeenCalledWith(
            workspaceUser.tierId,
          );
          expect(userRepository.updateBy).not.toHaveBeenCalled();
        });
      });

      describe('when updating storage and seats', () => {
        it('When updating with maxSpaceBytes and numberOfSeats, then it should update accordingly', async () => {
          jest
            .spyOn(userRepository, 'findByUuid')
            .mockResolvedValueOnce(owner)
            .mockResolvedValueOnce(workspaceUser);
          jest
            .spyOn(workspaceUseCases, 'findOne')
            .mockResolvedValueOnce(workspace);
          jest
            .spyOn(workspaceUseCases, 'updateWorkspaceLimit')
            .mockResolvedValueOnce();
          jest
            .spyOn(workspaceUseCases, 'updateWorkspaceMemberCount')
            .mockResolvedValueOnce();

          await service.updateWorkspace(owner.uuid, {
            maxSpaceBytes,
            numberOfSeats,
          });

          expect(workspaceUseCases.updateWorkspaceLimit).toHaveBeenCalledWith(
            workspace.id,
            maxSpaceBytes,
            numberOfSeats,
          );
          expect(
            workspaceUseCases.updateWorkspaceMemberCount,
          ).toHaveBeenCalledWith(workspace.id, numberOfSeats);
        });

        it('When updating with same numberOfSeats, then it should not update the seats', async () => {
          jest
            .spyOn(userRepository, 'findByUuid')
            .mockResolvedValueOnce(owner)
            .mockResolvedValueOnce(workspaceUser);
          jest
            .spyOn(workspaceUseCases, 'findOne')
            .mockResolvedValueOnce(workspace);
          jest
            .spyOn(workspaceUseCases, 'updateWorkspaceLimit')
            .mockResolvedValueOnce();
          jest
            .spyOn(workspaceUseCases, 'updateWorkspaceMemberCount')
            .mockResolvedValueOnce();

          await service.updateWorkspace(owner.uuid, {
            maxSpaceBytes,
            numberOfSeats: workspace.numberOfSeats,
          });

          expect(workspaceUseCases.updateWorkspaceLimit).toHaveBeenCalledWith(
            workspace.id,
            maxSpaceBytes,
            workspace.numberOfSeats,
          );
          expect(
            workspaceUseCases.updateWorkspaceMemberCount,
          ).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('handleFailedPayment', () => {
    const testUserId = '87204d6b-c4a7-4f38-bd99-f7f47964a643';
    const testUser = newUser({
      attributes: { uuid: testUserId, email: 'user@example.com' },
    });

    it('When called with valid userId, then it should find user and send failed payment email', async () => {
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(testUser);
      jest.spyOn(mailerService, 'sendFailedPaymentEmail').mockResolvedValue();

      const result = await service.handleFailedPayment(testUserId);

      expect(result).toStrictEqual({ success: true });
      expect(userRepository.findByUuid).toHaveBeenCalledWith(testUserId);
      expect(mailerService.sendFailedPaymentEmail).toHaveBeenCalledWith(
        testUser.email,
      );
    });

    it('When user is not found, then it should throw NotFoundException', async () => {
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(null);

      await expect(service.handleFailedPayment(testUserId)).rejects.toThrow(
        NotFoundException,
      );

      expect(userRepository.findByUuid).toHaveBeenCalledWith(testUserId);
      expect(mailerService.sendFailedPaymentEmail).not.toHaveBeenCalled();
    });

    it('When mailer service throws error, then it should propagate', async () => {
      const error = new Error('Email sending failed');
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(testUser);
      jest
        .spyOn(mailerService, 'sendFailedPaymentEmail')
        .mockRejectedValue(error);

      await expect(service.handleFailedPayment(testUserId)).rejects.toThrow(
        error,
      );
    });
  });

  describe('getUserLimitOverrides', () => {
    const user = newUser();
    const limit1 = newFeatureLimit({
      type: LimitTypes.Counter,
      value: '10',
      label: LimitLabels.MaxSharedItems,
    });
    const limit2 = newFeatureLimit({
      type: LimitTypes.Boolean,
      value: 'true',
      label: LimitLabels.CliAccess,
    });
    const overriddenLimits = [limit1, limit2];

    it('When user is not found, then it should throw', async () => {
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(null);

      await expect(service.getUserLimitOverrides(user.uuid)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('When user exists, then it should return all overridden limits for the user', async () => {
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(user);
      jest
        .spyOn(limitsRepository, 'findAllUserOverriddenLimits')
        .mockResolvedValue(overriddenLimits);

      const result = await service.getUserLimitOverrides(user.uuid);

      expect(result).toEqual(overriddenLimits);
    });
  });

  describe('findLimitByLabelAndValue', () => {
    const limit = newFeatureLimit({
      type: LimitTypes.Boolean,
      value: 'true',
      label: LimitLabels.CliAccess,
    });

    it('When limit exists, then it should return the limit', async () => {
      jest
        .spyOn(limitsRepository, 'findLimitByLabelAndValue')
        .mockResolvedValue(limit);

      const result = await service.findLimitByLabelAndValue(
        LimitLabels.CliAccess,
        'true',
      );

      expect(result).toEqual(limit);
      expect(limitsRepository.findLimitByLabelAndValue).toHaveBeenCalledWith(
        LimitLabels.CliAccess,
        'true',
      );
    });

    it('When limit does not exist, then it should return null', async () => {
      jest
        .spyOn(limitsRepository, 'findLimitByLabelAndValue')
        .mockResolvedValue(null);

      const result = await service.findLimitByLabelAndValue(
        LimitLabels.CliAccess,
        'false',
      );

      expect(result).toBeNull();
      expect(limitsRepository.findLimitByLabelAndValue).toHaveBeenCalledWith(
        LimitLabels.CliAccess,
        'false',
      );
    });
  });

  describe('overrideLimitForUser', () => {
    const user = newUser();
    const cliLimit = newFeatureLimit({
      type: LimitTypes.Boolean,
      value: 'true',
      label: LimitLabels.CliAccess,
    });

    it('When user is not found, then it should throws', async () => {
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(null);

      await expect(
        service.overrideLimitForUser(user.uuid, 'cli', 'true'),
      ).rejects.toThrow(NotFoundException);
    });

    it('When feature name is invalid, then it should throw', async () => {
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(user);

      await expect(
        service.overrideLimitForUser(user.uuid, 'invalid-feature', 'true'),
      ).rejects.toThrow(BadRequestException);
    });

    it('When limit is not found for label and value combination, then it should throw', async () => {
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(user);
      jest
        .spyOn(limitsRepository, 'findLimitByLabelAndValue')
        .mockResolvedValue(null);

      await expect(
        service.overrideLimitForUser(user.uuid, 'cli', 'invalid-value'),
      ).rejects.toThrow(BadRequestException);
    });

    it('When all validations pass, then it should create override successfully', async () => {
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(user);
      jest
        .spyOn(limitsRepository, 'findLimitByLabelAndValue')
        .mockResolvedValue(cliLimit);
      jest.spyOn(limitsRepository, 'upsertOverridenLimit');

      await expect(
        service.overrideLimitForUser(user.uuid, 'cli', 'true'),
      ).resolves.not.toThrow();

      expect(userRepository.findByUuid).toHaveBeenCalledWith(user.uuid);
      expect(limitsRepository.findLimitByLabelAndValue).toHaveBeenCalledWith(
        LimitLabels.CliAccess,
        'true',
      );
      expect(limitsRepository.upsertOverridenLimit).toHaveBeenCalledWith(
        user.uuid,
        cliLimit.id,
      );
    });
  });
});
