import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { AttemptChangeEmailModel } from './attempt-change-email.model';
import { UserEmailAlreadyInUseException } from './exception/user-email-already-in-use.exception';

import {
  MailLimitReachedException,
  UserUseCases,
  ReferralsNotAvailableError,
  UserAlreadyRegisteredError,
} from './user.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileUseCases } from '../file/file.usecase';
import { AccountTokenAction, User } from './user.domain';
import { SequelizeUserRepository } from './user.repository';
import { SequelizeSharedWorkspaceRepository } from '../../shared-workspace/shared-workspace.repository';
import { AvatarService } from '../../externals/avatar/avatar.service';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { ConfigService } from '@nestjs/config';
import { Folder, FolderAttributes } from '../folder/folder.domain';
import { SequelizeAttemptChangeEmailRepository } from './attempt-change-email.repository';
import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import {
  Sign,
  SignEmail,
  SignWithCustomDuration,
} from '../../middlewares/passport';
import { getTokenDefaultIat } from '../../lib/jwt';
import { UserNotFoundException } from './exception/user-not-found.exception';
import { AttemptChangeEmailNotFoundException } from './exception/attempt-change-email-not-found.exception';
import { AttemptChangeEmailHasExpiredException } from './exception/attempt-change-email-has-expired.exception';
import { AttemptChangeEmailAlreadyVerifiedException } from './exception/attempt-change-email-already-verified.exception';
import {
  newMailLimit,
  newUser,
  newWorkspaceInvite,
  newNotificationToken,
  newFile,
  newFolder,
  newKeyServer,
  newWorkspace,
  newWorkspaceUser,
  newPreCreatedUser,
} from '../../../test/fixtures';
import { MailTypes } from '../security/mail-limit/mailTypes';
import { SequelizeWorkspaceRepository } from '../workspaces/repositories/workspaces.repository';
import * as openpgpUtils from '../../externals/asymmetric-encryption/openpgp';
import { SequelizeMailLimitRepository } from '../security/mail-limit/mail-limit.repository';
import {
  DeviceType,
  RegisterNotificationTokenDto,
} from './dto/register-notification-token.dto';
import { UserNotificationTokens } from './user-notification-tokens.domain';
import { v4 } from 'uuid';
import { SequelizeKeyServerRepository } from '../keyserver/key-server.repository';
import * as speakeasy from 'speakeasy';
import { MailerService } from '../../externals/mailer/mailer.service';
import { LoginAccessDto } from '../auth/dto/login-access.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import {
  KeyServer,
  UserKeysEncryptVersions,
} from '../keyserver/key-server.domain';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { AppSumoUseCase } from '../app-sumo/app-sumo.usecase';
import { BackupUseCase } from '../backups/backup.usecase';
import { convertSizeToBytes } from '../../lib/convert-size-to-bytes';
import { CacheManagerService } from '../cache-manager/cache-manager.service';
import { AsymmetricEncryptionService } from '../../externals/asymmetric-encryption/asymmetric-encryption.service';
import { KyberProvider } from '../../externals/asymmetric-encryption/providers/kyber.provider';
import { SequelizeSharingRepository } from '../sharing/sharing.repository';
import { SequelizePreCreatedUsersRepository } from './pre-created-users.repository';
import { SharingInvite } from '../sharing/sharing.domain';
import { aes } from '@internxt/lib';
import { WorkspacesUsecases } from '../workspaces/workspaces.usecase';
import * as jwtLibrary from '../../lib/jwt';
import { JsonWebTokenError } from 'jsonwebtoken';
import { LegacyRecoverAccountDto } from './dto/legacy-recover-account.dto';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { AsymmetricEncryptionModule } from '../../externals/asymmetric-encryption/asymmetric-encryption.module';
import { PreCreateUserDto } from './dto/pre-create-user.dto';
import { IncompleteCheckoutDto } from './dto/incomplete-checkout.dto';
import * as bip39 from 'bip39';
import getEnv from '../../config/configuration';

const TEST_MNEMONIC =
  'album middle away ecology napkin quote buffalo method tooth mask laundry film add path suggest heart unaware project neck bird force heavy put latin';

jest.mock('../../middlewares/passport', () => {
  const originalModule = jest.requireActual('../../middlewares/passport');
  return {
    __esModule: true,
    ...originalModule,
    SignWithCustomDuration: jest.fn(
      (_payload, _secret, _expiresIn) => 'anyToken',
    ),
    Sign: jest.fn(() => 'newToken'),
    SignEmail: jest.fn(() => 'token'),
  };
});

describe('User use cases', () => {
  let userUseCases: UserUseCases;
  let folderUseCases: FolderUseCases;
  let fileUseCases: FileUseCases;
  let userRepository: SequelizeUserRepository;
  let keyServerRepository: SequelizeKeyServerRepository;
  let bridgeService: BridgeService;
  let sharedWorkspaceRepository: SequelizeSharedWorkspaceRepository;
  let cryptoService: CryptoService;
  let attemptChangeEmailRepository: SequelizeAttemptChangeEmailRepository;
  let configService: ConfigService;
  let mailLimitRepository: SequelizeMailLimitRepository;
  let workspaceRepository: SequelizeWorkspaceRepository;
  let mailerService: MailerService;
  let avatarService: AvatarService;
  let keyServerUseCases: KeyServerUseCases;
  let appSumoUseCases: AppSumoUseCase;
  let backupUseCases: BackupUseCase;
  let cacheManagerService: CacheManagerService;
  let loggerMock: DeepMocked<Logger>;
  let sharingRepository: SequelizeSharingRepository;
  let preCreatedUsersRepository: SequelizePreCreatedUsersRepository;
  let asymmetricEncryptionService: AsymmetricEncryptionService;
  let workspaceUseCases: WorkspacesUsecases;

  const user = User.build({
    id: 1,
    userId: 'userId',
    name: 'User Owner',
    lastname: 'Lastname',
    email: 'fake@internxt.com',
    username: 'fake',
    bridgeUser: null,
    rootFolderId: 1,
    errorLoginCount: 0,
    isEmailActivitySended: 1,
    referralCode: null,
    referrer: null,
    syncDate: new Date(),
    uuid: v4(),
    lastResend: new Date(),
    credit: null,
    welcomePack: true,
    registerCompleted: true,
    backupsBucket: 'bucket',
    sharedWorkspace: true,
    avatar: 'avatar',
    password: '',
    mnemonic: '',
    hKey: undefined,
    secret_2FA: '',
    lastPasswordChangedAt: new Date(),
    emailVerified: false,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    loggerMock = createMock<Logger>();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [],
      providers: [UserUseCases, AsymmetricEncryptionService, KyberProvider],
    })
      .useMocker(() => createMock())
      .setLogger(loggerMock)
      .compile();

    await moduleRef.init();

    folderUseCases = moduleRef.get<FolderUseCases>(FolderUseCases);
    fileUseCases = moduleRef.get<FileUseCases>(FileUseCases);
    userUseCases = moduleRef.get<UserUseCases>(UserUseCases);
    configService = moduleRef.get<ConfigService>(ConfigService);
    userRepository = moduleRef.get<SequelizeUserRepository>(
      SequelizeUserRepository,
    );
    keyServerRepository = moduleRef.get<SequelizeKeyServerRepository>(
      SequelizeKeyServerRepository,
    );
    bridgeService = moduleRef.get<BridgeService>(BridgeService);
    userRepository = moduleRef.get<SequelizeUserRepository>(
      SequelizeUserRepository,
    );
    sharedWorkspaceRepository =
      moduleRef.get<SequelizeSharedWorkspaceRepository>(
        SequelizeSharedWorkspaceRepository,
      );
    cryptoService = moduleRef.get<CryptoService>(CryptoService);
    attemptChangeEmailRepository =
      moduleRef.get<SequelizeAttemptChangeEmailRepository>(
        SequelizeAttemptChangeEmailRepository,
      );
    configService = moduleRef.get<ConfigService>(ConfigService);
    mailLimitRepository = moduleRef.get<SequelizeMailLimitRepository>(
      SequelizeMailLimitRepository,
    );
    workspaceRepository = moduleRef.get<SequelizeWorkspaceRepository>(
      SequelizeWorkspaceRepository,
    );
    mailerService = moduleRef.get<MailerService>(MailerService);
    avatarService = moduleRef.get<AvatarService>(AvatarService);
    keyServerUseCases = moduleRef.get<KeyServerUseCases>(KeyServerUseCases);

    appSumoUseCases = moduleRef.get<AppSumoUseCase>(AppSumoUseCase);
    backupUseCases = moduleRef.get<BackupUseCase>(BackupUseCase);
    cacheManagerService =
      moduleRef.get<CacheManagerService>(CacheManagerService);
    sharingRepository = moduleRef.get<SequelizeSharingRepository>(
      SequelizeSharingRepository,
    );
    preCreatedUsersRepository =
      moduleRef.get<SequelizePreCreatedUsersRepository>(
        SequelizePreCreatedUsersRepository,
      );
    asymmetricEncryptionService = moduleRef.get<AsymmetricEncryptionService>(
      AsymmetricEncryptionService,
    );
    workspaceUseCases = moduleRef.get<WorkspacesUsecases>(WorkspacesUsecases);
  });

  describe('Resetting a user', () => {
    it('When all options are false, then the reset does nothing', async () => {
      const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
      const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');

      await userUseCases.resetUser(user, {
        deleteFiles: false,
        deleteFolders: false,
        deleteShares: false,
        deleteWorkspaces: false,
        deleteBackups: false,
      });

      expect(deleteFoldersSpy).not.toHaveBeenCalled();
      expect(deleteFilesSpy).not.toHaveBeenCalled();
    });

    describe('When options are provided', () => {
      it('When delete shares is true, then the shares are deleted', async () => {
        const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
        const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');

        await userUseCases.resetUser(user, {
          deleteFiles: false,
          deleteFolders: false,
          deleteShares: true,
          deleteWorkspaces: false,
          deleteBackups: false,
        });

        expect(deleteFoldersSpy).not.toHaveBeenCalled();
        expect(deleteFilesSpy).not.toHaveBeenCalled();
      });

      it('When delete workspaces is true, then user owned workspaces are reset and user is removed from invited workspaces', async () => {
        await userUseCases.resetUser(user, {
          deleteFiles: false,
          deleteFolders: false,
          deleteShares: false,
          deleteWorkspaces: true,
          deleteBackups: false,
        });

        expect(
          workspaceUseCases.emptyAllUserOwnedWorkspaces,
        ).toHaveBeenCalled();

        expect(
          workspaceUseCases.removeUserFromNonOwnedWorkspaces,
        ).toHaveBeenCalled();
      });

      it('When delete backups is true, then the user backups are deleted', async () => {
        const deleteUserBackupsSpy = jest
          .spyOn(backupUseCases, 'deleteUserBackups')
          .mockResolvedValue({ deletedBackups: 1, deletedDevices: 1 });

        await userUseCases.resetUser(user, {
          deleteFiles: false,
          deleteFolders: false,
          deleteShares: false,
          deleteWorkspaces: false,
          deleteBackups: true,
        });

        expect(deleteUserBackupsSpy).toHaveBeenCalledWith(user.id);
      });

      describe('When resources do not exist', () => {
        it('When delete folders is true, then the folders are deleted', async () => {
          const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
          const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');
          const getFoldersSpy = jest.spyOn(folderUseCases, 'getFolders');
          const folders = [];
          getFoldersSpy.mockReturnValue(Promise.resolve(folders));

          await userUseCases.resetUser(user, {
            deleteFiles: false,
            deleteFolders: true,
            deleteShares: false,
            deleteWorkspaces: false,
            deleteBackups: false,
          });

          expect(getFoldersSpy).toHaveBeenCalledWith(
            user.id,
            { parentId: user.rootFolderId, removed: false },
            {
              limit: 50,
              offset: 0,
            },
          );
          expect(deleteFoldersSpy).toHaveBeenCalledWith(user, folders);
          expect(deleteFilesSpy).not.toHaveBeenCalled();
        });

        it('When delete files is true, then the files are deleted', async () => {
          const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
          const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');
          const getFilesSpy = jest.spyOn(fileUseCases, 'getFilesNotDeleted');
          const files = [];
          getFilesSpy.mockReturnValue(Promise.resolve(files));

          await userUseCases.resetUser(user, {
            deleteFiles: true,
            deleteFolders: false,
            deleteShares: false,
            deleteWorkspaces: false,
            deleteBackups: false,
          });

          expect(getFilesSpy).toHaveBeenCalledWith(
            user.id,
            { folderId: user.rootFolderId },
            {
              limit: 50,
              offset: 0,
            },
          );
          expect(deleteFoldersSpy).not.toHaveBeenCalled();
          expect(deleteFilesSpy).toHaveBeenCalledWith(user, files);
        });
      });

      describe('When resources exist', () => {
        it('When delete folders is true, then the folders are deleted', async () => {
          const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
          const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');
          const getFoldersSpy = jest.spyOn(folderUseCases, 'getFolders');
          const folders = [Folder.build({} as FolderAttributes)];
          getFoldersSpy.mockReturnValue(Promise.resolve(folders));

          await userUseCases.resetUser(user, {
            deleteFiles: false,
            deleteFolders: true,
            deleteShares: false,
            deleteWorkspaces: false,
            deleteBackups: false,
          });

          expect(getFoldersSpy).toHaveBeenCalledWith(
            user.id,
            { parentId: user.rootFolderId, removed: false },
            {
              limit: 50,
              offset: 0,
            },
          );
          expect(deleteFoldersSpy).toHaveBeenCalledWith(user, folders);
          expect(deleteFilesSpy).not.toHaveBeenCalled();
        });

        it('When delete files is true, then the files are deleted', async () => {
          const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
          const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');
          const getFilesSpy = jest.spyOn(fileUseCases, 'getFilesNotDeleted');
          const files = [newFile(), newFile()];
          getFilesSpy.mockReturnValue(Promise.resolve(files));

          await userUseCases.resetUser(user, {
            deleteFiles: true,
            deleteFolders: false,
            deleteShares: false,
            deleteWorkspaces: false,
            deleteBackups: false,
          });

          expect(getFilesSpy).toHaveBeenCalledWith(
            user.id,
            { folderId: user.rootFolderId },
            {
              limit: 50,
              offset: 0,
            },
          );
          expect(deleteFoldersSpy).not.toHaveBeenCalled();
          expect(deleteFilesSpy).toHaveBeenCalledWith(user, files);
        });
      });
    });
  });

  describe('replacePreCreatedUserWorkspaceInvitations', () => {
    it('When pre created user is replaced successfully, then update invitations to new user uuid', async () => {
      const preCreatedUserUuid = 'pre-created-user-uuid';
      const newUserUuid = 'new-user-uuid';
      const privateKeyInBase64 = 'private-key';
      const decryptedEncryptionKey = 'decrypted-key';
      const newEncryptedKey = 'new-encrypted-key';
      const newPublicKey = 'public-key';
      const invitedUser = newUser();
      const invitations = [
        newWorkspaceInvite({
          invitedUser: invitedUser.uuid,
        }),
        newWorkspaceInvite({
          invitedUser: invitedUser.uuid,
        }),
      ];

      jest
        .spyOn(openpgpUtils, 'decryptMessageWithPrivateKey')
        .mockResolvedValue(decryptedEncryptionKey);
      jest
        .spyOn(openpgpUtils, 'encryptMessageWithPublicKey')
        .mockResolvedValue(newEncryptedKey);
      jest
        .spyOn(workspaceRepository, 'findInvitesBy')
        .mockResolvedValue(invitations);

      await userUseCases.replacePreCreatedUserWorkspaceInvitations(
        preCreatedUserUuid,
        newUserUuid,
        privateKeyInBase64,
        newPublicKey,
      );

      expect(
        workspaceRepository.bulkUpdateInvitesKeysAndUsers,
      ).toHaveBeenCalledWith(
        invitations.map(() =>
          expect.objectContaining({
            invitedUser: expect.stringContaining(newUserUuid),
          }),
        ),
      );
    });

    it('When no pre created user does not have invitations, then should not update', async () => {
      jest.spyOn(workspaceRepository, 'findInvitesBy').mockResolvedValue([]);

      await userUseCases.replacePreCreatedUserWorkspaceInvitations(
        'pre-created-user-uuid',
        'new-user-uuid',
        'private-key',
        'new-public-key',
      );

      expect(
        workspaceRepository.bulkUpdateInvitesKeysAndUsers,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Unblocking user account', () => {
    describe('Request Account unblock', () => {
      const fixedSystemCurrentDate = new Date('2020-02-19');

      beforeAll(async () => {
        jest.useFakeTimers();
        jest.setSystemTime(fixedSystemCurrentDate);
      });

      afterAll(async () => {
        jest.useRealTimers();
      });

      it('When user does not exist, then do nothing', async () => {
        const userFindByEmailSpy = jest.spyOn(userRepository, 'findByEmail');
        userFindByEmailSpy.mockReturnValueOnce(null);

        await expect(
          userUseCases.sendAccountUnblockEmail(user.email),
        ).resolves.toBeUndefined();
      });

      it('When user reached mails limit, then fail', async () => {
        const limit = newMailLimit({
          userId: user.id,
          attemptsCount: 5,
          attemptsLimit: 5,
        });
        jest.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce(user);
        jest
          .spyOn(mailLimitRepository, 'findOrCreate')
          .mockResolvedValueOnce([limit, false]);

        await expect(
          userUseCases.sendAccountUnblockEmail(user.email),
        ).rejects.toBeInstanceOf(MailLimitReachedException);
      });

      it('When user exists and email is sent, then mailLimit is updated', async () => {
        const limit = newMailLimit({ userId: user.id });
        jest.spyOn(mailLimitRepository, 'updateByUserIdAndMailType');
        jest.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce(user);
        jest.spyOn(configService, 'get').mockReturnValue('secret');
        jest
          .spyOn(mailLimitRepository, 'findOrCreate')
          .mockResolvedValueOnce([limit, false]);

        await userUseCases.sendAccountUnblockEmail(user.email);

        expect(SignWithCustomDuration).toHaveBeenCalledWith(
          {
            payload: {
              uuid: user.uuid,
              email: user.email,
              action: AccountTokenAction.Unblock,
            },
            iat: getTokenDefaultIat(),
          },
          'secret',
          '48h',
        );
        expect(
          mailLimitRepository.updateByUserIdAndMailType,
        ).toHaveBeenCalledWith(user.id, MailTypes.UnblockAccount, limit);
      });
    });

    describe('Unblock account', () => {
      it('When user does not exist, then fail', async () => {
        const userFindByUuidSpy = jest.spyOn(userRepository, 'findByUuid');
        userFindByUuidSpy.mockReturnValueOnce(null);

        await expect(userUseCases.unblockAccount(user.uuid, 0)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('When token was issued before lastMailSent date, then fail', async () => {
        const tokenIat = getTokenDefaultIat();
        const futureDate = new Date(tokenIat * 1000);
        futureDate.setSeconds(futureDate.getSeconds() + 1);
        const mailLimit = newMailLimit({ lastMailSent: futureDate });

        jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(user);
        jest
          .spyOn(mailLimitRepository, 'findByUserIdAndMailType')
          .mockResolvedValueOnce(mailLimit);

        await expect(
          userUseCases.unblockAccount(user.uuid, tokenIat),
        ).rejects.toThrow(ForbiddenException);
      });

      it('When token was issued before user lastPasswordChanged date, then fail', async () => {
        const tokenIat = getTokenDefaultIat();
        const futureDate = new Date(tokenIat * 1000);
        futureDate.setSeconds(futureDate.getSeconds() + 1);
        const mailLimit = newMailLimit({
          lastMailSent: new Date(tokenIat * 1000),
        });
        const userWithPasswordChanged = new User({
          ...user,
          lastPasswordChangedAt: futureDate,
        });
        jest
          .spyOn(userRepository, 'findByUuid')
          .mockResolvedValueOnce(userWithPasswordChanged);
        jest
          .spyOn(mailLimitRepository, 'findByUserIdAndMailType')
          .mockResolvedValueOnce(mailLimit);

        await expect(
          userUseCases.unblockAccount(user.uuid, tokenIat),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });

  describe('changeUserEmailById', () => {
    it('When changing the user email successfully, Then it should return the old and new email details', async () => {
      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(undefined);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(user);

      const result = await userUseCases.changeUserEmailById(
        user.uuid,
        'newemail@example.com',
      );

      expect(result).toEqual({
        oldEmail: user.email,
        newEmail: 'newemail@example.com',
      });
    });

    it('When the user is a guest on a shared workspace, Then it should not call bridgeService.updateUserEmail', async () => {
      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(undefined);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(
        User.build({
          ...user,
          bridgeUser: 'bridgeUser@inxt.com',
        }),
      );

      await userUseCases.changeUserEmailById(user.uuid, 'newemail@example.com');

      expect(bridgeService.updateUserEmail).not.toHaveBeenCalled();
      expect(userRepository.updateByUuid).toHaveBeenCalledWith(user.uuid, {
        email: 'newemail@example.com',
        username: 'newemail@example.com',
      });
    });

    it('When the user is a guest on a shared workspace, Then it should call sharedWorkspaceRepository.updateGuestEmail', async () => {
      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(undefined);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(
        User.build({
          ...user,
          bridgeUser: 'bridgeUser@inxt.com',
        }),
      );

      await userUseCases.changeUserEmailById(user.uuid, 'newemail@example.com');

      expect(sharedWorkspaceRepository.updateGuestEmail).toHaveBeenCalledWith(
        user.email,
        'newemail@example.com',
      );
      expect(userRepository.updateByUuid).toHaveBeenCalledWith(user.uuid, {
        email: 'newemail@example.com',
        username: 'newemail@example.com',
      });
    });

    it('When the user is not a guest on a shared workspace, Then it should update the bridgeUser property', async () => {
      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(undefined);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(
        User.build({
          ...user,
          bridgeUser: user.email,
        }),
      );

      await userUseCases.changeUserEmailById(user.uuid, 'newemail@example.com');

      expect(bridgeService.updateUserEmail).toHaveBeenCalledWith(
        user.uuid,
        'newemail@example.com',
      );
      expect(userRepository.updateByUuid).toHaveBeenCalledWith(user.uuid, {
        email: 'newemail@example.com',
        username: 'newemail@example.com',
        bridgeUser: 'newemail@example.com',
      });
    });

    it('When an exception is thrown, Then it should call bridgeService.updateUserEmail', async () => {
      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(undefined);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(user);

      jest
        .spyOn(bridgeService, 'updateUserEmail')
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      jest
        .spyOn(userRepository, 'updateByUuid')
        .mockRejectedValue(new Error('Database error'));

      await expect(
        userUseCases.changeUserEmailById(user.uuid, 'newuseremail@inxt.com'),
      ).rejects.toThrow('Database error');

      expect(bridgeService.updateUserEmail).toHaveBeenCalledWith(
        user.uuid,
        user.email,
      );
    });

    it('When the user is not found, Then it should throw UserNotFoundException', async () => {
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(undefined);

      await expect(
        userUseCases.changeUserEmailById(
          'nonexistentuuid',
          'newemail@example.com',
        ),
      ).rejects.toThrow(UserNotFoundException);
    });

    it('When the user email is already in use, Then it should throw UserEmailAlreadyInUseException', async () => {
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(user);
      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(user);

      await expect(
        userUseCases.changeUserEmailById(
          'nonexistentuuid',
          'newemail@example.com',
        ),
      ).rejects.toThrow(UserEmailAlreadyInUseException);
    });
  });

  describe('acceptAttemptChangeEmail', () => {
    it('When accepting an attempt, Then it should return new email details with a new token', async () => {
      const encryptedId = 'encryptedId';
      const decryptedId = '1';
      const newEmail = 'newemail@example.com';
      jest.spyOn(cryptoService, 'decryptText').mockReturnValue(decryptedId);

      const attemptChangeEmail = {
        id: 1,
        userUuid: user.uuid,
        newEmail: newEmail,
        isExpiresAt: false,
        isVerified: false,
      };

      jest
        .spyOn(attemptChangeEmailRepository, 'getOneById')
        .mockResolvedValue(attemptChangeEmail as any);
      jest
        .spyOn(attemptChangeEmailRepository, 'acceptAttemptChangeEmail')
        .mockResolvedValue(undefined);

      jest.spyOn(userUseCases, 'changeUserEmailById').mockResolvedValue({
        oldEmail: user.email,
        newEmail: newEmail,
      });

      jest
        .spyOn(userRepository, 'findByUuid')
        .mockResolvedValueOnce(User.build({ ...user }));
      jest.spyOn(userUseCases, 'getNewTokenPayload').mockReturnValue({} as any);
      jest.spyOn(configService, 'get').mockReturnValueOnce('a-secret-key');

      const result = await userUseCases.acceptAttemptChangeEmail(encryptedId);

      expect(result).toMatchObject({
        oldEmail: user.email,
        newEmail: newEmail,
        newAuthentication: {
          token: 'token',
          newToken: 'newToken',
          user: expect.objectContaining({
            email: newEmail,
            username: newEmail,
          }),
        },
      });
    });

    it('When the attempt is not found, Then it should throw AttemptChangeEmailNotFoundException', async () => {
      jest.spyOn(cryptoService, 'decryptText').mockReturnValue('1');
      jest
        .spyOn(attemptChangeEmailRepository, 'getOneById')
        .mockResolvedValue(undefined);

      await expect(
        userUseCases.acceptAttemptChangeEmail('encryptedId'),
      ).rejects.toThrow(AttemptChangeEmailNotFoundException);
    });

    it('When the attempt is expired, Then it should throw AttemptChangeEmailHasExpiredException', async () => {
      jest.spyOn(cryptoService, 'decryptText').mockReturnValue('1');
      jest.spyOn(attemptChangeEmailRepository, 'getOneById').mockResolvedValue(
        createMock<AttemptChangeEmailModel>({
          isExpired: true,
        }),
      );

      await expect(
        userUseCases.acceptAttemptChangeEmail('encryptedId'),
      ).rejects.toThrow(AttemptChangeEmailHasExpiredException);
    });

    it('When the attempt is already verified, Then it should throw AttemptChangeEmailAlreadyVerifiedException', async () => {
      jest.spyOn(cryptoService, 'decryptText').mockReturnValue('1');
      jest.spyOn(attemptChangeEmailRepository, 'getOneById').mockResolvedValue(
        createMock<AttemptChangeEmailModel>({
          isExpired: false,
          isVerified: true,
        }),
      );

      await expect(
        userUseCases.acceptAttemptChangeEmail('encryptedId'),
      ).rejects.toThrow(AttemptChangeEmailAlreadyVerifiedException);
    });

    it('When changeUserEmailById fails, Then it should throw an error', async () => {
      jest.spyOn(cryptoService, 'decryptText').mockReturnValue('1');
      jest.spyOn(attemptChangeEmailRepository, 'getOneById').mockResolvedValue(
        createMock<AttemptChangeEmailModel>({
          isExpired: false,
          isVerified: false,
        }),
      );

      jest
        .spyOn(userUseCases, 'changeUserEmailById')
        .mockRejectedValue(new Error('Change email failed'));

      await expect(
        userUseCases.acceptAttemptChangeEmail('encryptedId'),
      ).rejects.toThrow('Change email failed');
    });
  });

  describe('registerUserNotificationToken', () => {
    const body: RegisterNotificationTokenDto = {
      token: 'token',
      type: DeviceType.macos,
    };
    it('When registering a notification token where the user has 10 tokens, Then it should throw a BadRequestException', async () => {
      const user = newUser();

      jest
        .spyOn(userRepository, 'getNotificationTokenCount')
        .mockResolvedValue(10);

      await expect(
        userUseCases.registerUserNotificationToken(user, body),
      ).rejects.toThrow(BadRequestException);
    });
    it('When registering a notification token that already exists, Then it should throw a BadRequestException', async () => {
      const user = newUser();

      jest
        .spyOn(userRepository, 'getNotificationTokenCount')
        .mockResolvedValue(0);
      jest
        .spyOn(userRepository, 'getNotificationTokens')
        .mockResolvedValueOnce([newNotificationToken()]);

      await expect(
        userUseCases.registerUserNotificationToken(user, body),
      ).rejects.toThrow(BadRequestException);
    });
    it('When registering a notification token, Then it should call userRepository.addNotificationToken', async () => {
      const user = newUser();

      jest
        .spyOn(userRepository, 'getNotificationTokenCount')
        .mockResolvedValue(0);
      jest.spyOn(userRepository, 'addNotificationToken');

      await userUseCases.registerUserNotificationToken(user, body);

      expect(userRepository.addNotificationToken).toHaveBeenCalledWith(
        user.uuid,
        body.token,
        body.type,
      );
    });
  });

  describe('getUserNotificationTokens', () => {
    it("When getting notification tokens, Then it should return the user's tokens", async () => {
      const user = newUser();
      const mockTokens: UserNotificationTokens[] = [
        newNotificationToken(),
        newNotificationToken(),
      ];

      jest
        .spyOn(userRepository, 'getNotificationTokens')
        .mockResolvedValueOnce(mockTokens);

      const tokens = await userUseCases.getUserNotificationTokens(user);

      expect(userRepository.getNotificationTokens).toHaveBeenCalledWith(
        user.uuid,
      );
      expect(tokens).toEqual(mockTokens);
    });
  });

  describe('getAuthTokens', () => {
    const jwtSecret = 'secret-jwt';

    beforeEach(() => {
      jest.spyOn(configService, 'get').mockReturnValueOnce(jwtSecret);
    });

    it('When called, then it should return respective tokens', async () => {
      const result = await userUseCases.getAuthTokens(user);

      expect(result).toEqual({
        token: 'token',
        newToken: 'newToken',
      });
    });

    it('When called with custom iat, then it should create the tokens with custom iat', async () => {
      const customIat = 1620000000;

      jest.spyOn(configService, 'get').mockReturnValue(jwtSecret as never);

      await userUseCases.getAuthTokens(user, customIat);

      expect(SignEmail).toHaveBeenCalledWith(
        user.email,
        jwtSecret,
        '3d',
        customIat,
      );

      expect(Sign).toHaveBeenCalledWith(
        {
          jti: expect.stringMatching(`[a-f0-9-]{36}`),
          sub: user.uuid,
          payload: {
            uuid: user.uuid,
            email: user.email,
            name: user.name,
            lastname: user.lastname,
            username: user.username,
            sharedWorkspace: true,
            networkCredentials: {
              user: user.bridgeUser,
            },
            workspaces: {
              owners: [],
            },
          },
          iat: customIat,
        },
        jwtSecret,
        '3d',
      );
    });

    it('When called, then it should create the tokens with expected payload', async () => {
      const workspace = newWorkspace({ owner: user });
      const workspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user.uuid,
      });

      jest.spyOn(configService, 'get').mockReturnValue(jwtSecret as never);
      jest
        .spyOn(workspaceRepository, 'findUserAvailableWorkspaces')
        .mockResolvedValueOnce([{ workspace, workspaceUser }]);

      await userUseCases.getAuthTokens(user);

      expect(SignEmail).toHaveBeenCalledWith(
        user.email,
        jwtSecret,
        '3d',
        undefined,
      );

      expect(Sign).toHaveBeenCalledWith(
        {
          jti: expect.stringMatching(`[a-f0-9-]{36}`),
          sub: user.uuid,
          payload: {
            uuid: user.uuid,
            email: user.email,
            name: user.name,
            lastname: user.lastname,
            username: user.username,
            sharedWorkspace: true,
            networkCredentials: {
              user: user.bridgeUser,
            },
            workspaces: {
              owners: [workspace.ownerId],
            },
          },
        },
        jwtSecret,
        '3d',
      );
    });

    it('When called with custom token expiration, then it should create a token with expected duration', async () => {
      const workspace = newWorkspace({ owner: user });
      const workspaceUser = newWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user.uuid,
      });

      jest.spyOn(configService, 'get').mockReturnValue(jwtSecret as never);
      jest
        .spyOn(workspaceRepository, 'findUserAvailableWorkspaces')
        .mockResolvedValueOnce([{ workspace, workspaceUser }]);

      await userUseCases.getAuthTokens(user, undefined, '14d');

      expect(SignEmail).toHaveBeenCalledWith(
        user.email,
        jwtSecret,
        '14d',
        undefined,
      );

      expect(Sign).toHaveBeenCalledWith(
        {
          jti: expect.stringMatching(`[a-f0-9-]{36}`),
          sub: user.uuid,
          payload: {
            uuid: user.uuid,
            email: user.email,
            name: user.name,
            lastname: user.lastname,
            username: user.username,
            sharedWorkspace: true,
            networkCredentials: {
              user: user.bridgeUser,
            },
            workspaces: {
              owners: [workspace.ownerId],
            },
          },
        },
        jwtSecret,
        '14d',
      );
    });
  });

  describe('loginAccess', () => {
    const keys = newKeyServer();

    it('When an email in uppercase is provided, then it should be transformed to lowercase', async () => {
      const loginAccessDto: LoginAccessDto = {
        email: 'TEST@EXAMPLE.COM',
        password: v4(),
      };
      const emailLowerCase = 'test@example.com';
      const userData = newUser({ attributes: { email: emailLowerCase } });

      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(userData);

      await expect(userUseCases.loginAccess(loginAccessDto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(userRepository.findByUsername).toHaveBeenCalledWith(
        emailLowerCase,
      );
    });

    it('When a non-existing email is provided, then it should throw ', async () => {
      const loginAccessDto = {
        email: 'nonexistent@example.com',
        password: v4(),
        tfa: '',
        ...keys,
      };
      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(null);

      await expect(userUseCases.loginAccess(loginAccessDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('When login attempts limit is reached, then it should throw', async () => {
      const loginAccessDto = {
        email: 'test@example.com',
        password: v4(),
        tfa: '',
        ...keys,
      };
      const user = newUser({
        attributes: {
          email: 'test@example.com',
          password: v4(),
          errorLoginCount: 10,
        },
      });
      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(user);

      await expect(userUseCases.loginAccess(loginAccessDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('When the password is incorrect, then it should throw', async () => {
      const wrongPassword = v4();
      const loginAccessDto = {
        email: 'test@example.com',
        password: wrongPassword,
        tfa: '',
        ...keys,
      };
      const user = newUser({
        attributes: {
          email: 'test@example.com',
          password: v4(),
          errorLoginCount: 0,
        },
      });
      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(user);
      jest.spyOn(cryptoService, 'decryptText').mockReturnValue(wrongPassword);

      await expect(userUseCases.loginAccess(loginAccessDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('When login is successful, then it should return user and tokens', async () => {
      const hashedPassword = v4();
      const loginAccessDto = {
        email: 'test@example.com',
        password: v4(),
        tfa: '',
        ...keys,
      };
      const user = newUser({
        attributes: {
          email: 'test@example.com',
          password: hashedPassword,
          errorLoginCount: 0,
          secret_2FA: null,
        },
      });
      const keyServer = newKeyServer({
        ...keys,
        revocationKey: keys.revocationKey,
        userId: user.id,
      });

      const folder = newFolder({ owner: user, attributes: { bucket: v4() } });

      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(user);
      jest.spyOn(cryptoService, 'decryptText').mockReturnValue(hashedPassword);
      jest.spyOn(userUseCases, 'getAuthTokens').mockResolvedValueOnce({
        token: 'authToken',
        newToken: 'newAuthToken',
      });
      jest.spyOn(userUseCases, 'updateByUuid').mockResolvedValue(undefined);
      jest
        .spyOn(userUseCases, 'getOrCreateUserRootFolderAndBucket')
        .mockResolvedValueOnce(folder);
      jest.spyOn(keyServerRepository, 'findUserKeys').mockResolvedValue(null);
      jest.spyOn(keyServerRepository, 'create').mockResolvedValue(keyServer);

      const result = await userUseCases.loginAccess(loginAccessDto);

      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('email', 'test@example.com');
      expect(result.user).toHaveProperty('bucket', folder.bucket);
      expect(result).toHaveProperty('token', 'authToken');
      expect(result).toHaveProperty('newToken', 'newAuthToken');
    });

    it('When the 2FA code is wrong, then it should throw', async () => {
      const hashedPassword = v4();
      const loginAccessDto = {
        email: 'test@example.com',
        password: v4(),
        tfa: 'wrongTfa',
        ...keys,
      };
      const user = newUser({
        attributes: {
          email: 'test@example.com',
          password: hashedPassword,
          errorLoginCount: 0,
          secret_2FA: 'secret',
        },
      });
      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(user);
      jest.spyOn(cryptoService, 'decryptText').mockReturnValue(hashedPassword);
      jest.spyOn(speakeasy.totp, 'verifyDelta').mockReturnValue(undefined);

      await expect(userUseCases.loginAccess(loginAccessDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('When the 2FA code is valid, then it should return user and tokens', async () => {
      const hashedPassword = v4();
      const loginAccessDto = {
        email: 'test@example.com',
        password: v4(),
        tfa: 'okTfa',
        ...keys,
      };
      const user = newUser({
        attributes: {
          email: 'test@example.com',
          password: hashedPassword,
          errorLoginCount: 0,
          secret_2FA: 'secret',
        },
      });

      const keyServer = newKeyServer({
        ...keys,
        revocationKey: keys.revocationKey,
        userId: user.id,
      });

      const folder = newFolder({ owner: user, attributes: { bucket: v4() } });

      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(user);
      jest.spyOn(cryptoService, 'decryptText').mockReturnValue(hashedPassword);
      jest
        .spyOn(speakeasy.totp, 'verifyDelta')
        .mockReturnValue({ delta: 123456 });
      jest.spyOn(userUseCases, 'getAuthTokens').mockResolvedValueOnce({
        token: 'authToken',
        newToken: 'newAuthToken',
      });
      jest.spyOn(userUseCases, 'updateByUuid').mockResolvedValue(undefined);
      jest
        .spyOn(userUseCases, 'getOrCreateUserRootFolderAndBucket')
        .mockResolvedValueOnce(folder);
      jest.spyOn(keyServerRepository, 'findUserKeys').mockResolvedValue(null);
      jest.spyOn(keyServerRepository, 'create').mockResolvedValue(keyServer);

      const result = await userUseCases.loginAccess(loginAccessDto);

      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('email', 'test@example.com');
      expect(result.user).toHaveProperty('bucket', folder.bucket);
      expect(result).toHaveProperty('token', 'authToken');
      expect(result).toHaveProperty('newToken', 'newAuthToken');
    });

    it('When user without keys logs in, then it should return empty keys', async () => {
      const hashedPassword = 'hashedPassword';
      const user = newUser({
        attributes: {
          password: hashedPassword,
          errorLoginCount: 0,
          secret_2FA: null,
        },
      });
      const loginAccessDto: LoginAccessDto = {
        email: user.email,
        password: hashedPassword,
        tfa: '',
      };

      const folder = newFolder({ owner: user, attributes: { bucket: v4() } });

      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(user);
      jest.spyOn(cryptoService, 'decryptText').mockReturnValue(hashedPassword);
      jest.spyOn(userUseCases, 'getAuthTokens').mockResolvedValueOnce({
        token: 'authToken',
        newToken: 'newAuthToken',
      });
      jest.spyOn(userUseCases, 'updateByUuid').mockResolvedValue(undefined);
      jest
        .spyOn(folderUseCases, 'getUserRootFolder')
        .mockResolvedValueOnce(folder);
      jest
        .spyOn(keyServerUseCases, 'findUserKeys')
        .mockResolvedValue({ ecc: null, kyber: null });

      const result = await userUseCases.loginAccess(loginAccessDto);

      expect(result.user).toHaveProperty('keys', {
        ecc: {
          privateKey: null,
          publicKey: null,
        },
        kyber: {
          privateKey: null,
          publicKey: null,
        },
      });
    });

    it('When user without keys logs in and keys are sent, then it should save keys', async () => {
      const hashedPassword = 'hashedPassword';
      const user = newUser({
        attributes: {
          password: hashedPassword,
          errorLoginCount: 0,
          secret_2FA: null,
        },
      });
      const eccKeys = newKeyServer({ userId: user.id, ...keys.toJSON() });
      const kyberKeys = newKeyServer({
        userId: user.id,
        encryptVersion: UserKeysEncryptVersions.Kyber,
      });

      const loginAccessDto: LoginAccessDto = {
        email: user.email,
        password: hashedPassword,
        tfa: '',
        keys: {
          ecc: { ...eccKeys.toJSON() },
          kyber: { ...kyberKeys.toJSON() },
        },
      };

      const folder = newFolder({ owner: user, attributes: { bucket: v4() } });

      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(user);
      jest.spyOn(cryptoService, 'decryptText').mockReturnValue(hashedPassword);
      jest.spyOn(userUseCases, 'getAuthTokens').mockResolvedValueOnce({
        token: 'authToken',
        newToken: 'newAuthToken',
      });
      jest.spyOn(userUseCases, 'updateByUuid').mockResolvedValue(undefined);
      jest
        .spyOn(folderUseCases, 'getUserRootFolder')
        .mockResolvedValueOnce(folder);
      jest
        .spyOn(keyServerUseCases, 'findUserKeys')
        .mockResolvedValue({ ecc: null, kyber: null });
      jest
        .spyOn(keyServerUseCases, 'findOrCreateKeysForUser')
        .mockResolvedValueOnce(eccKeys);
      jest
        .spyOn(keyServerUseCases, 'findOrCreateKeysForUser')
        .mockResolvedValueOnce(kyberKeys);

      const result = await userUseCases.loginAccess(loginAccessDto);

      expect(keyServerUseCases.findOrCreateKeysForUser).toHaveBeenCalledWith(
        user.id,
        {
          publicKey: eccKeys.publicKey,
          privateKey: eccKeys.privateKey,
          revocationKey: eccKeys.revocationKey,
          encryptVersion: eccKeys.encryptVersion,
        },
      );
      expect(keyServerUseCases.findOrCreateKeysForUser).toHaveBeenCalledWith(
        user.id,
        {
          publicKey: kyberKeys.publicKey,
          privateKey: kyberKeys.privateKey,
          encryptVersion: kyberKeys.encryptVersion,
        },
      );
      expect(result.user).toHaveProperty('keys', {
        ecc: {
          privateKey: eccKeys.privateKey,
          publicKey: eccKeys.publicKey,
        },
        kyber: {
          privateKey: kyberKeys.privateKey,
          publicKey: kyberKeys.publicKey,
        },
      });
    });
  });

  describe('updateByUuid', () => {
    it('When updating user by UUID, then it should call userRepository.updateByUuid', async () => {
      const userUuid = v4();
      const payload = { name: 'New Name' };
      jest.spyOn(userRepository, 'updateByUuid').mockResolvedValue(undefined);

      await userUseCases.updateByUuid(userUuid, payload);

      expect(userRepository.updateByUuid).toHaveBeenCalledWith(
        userUuid,
        payload,
      );
    });
  });

  describe('logReferralError', () => {
    it('When an undefined error is logged, then it should log error message for undefined error', () => {
      const userId = v4();

      userUseCases.logReferralError(userId, new Error());

      expect(loggerMock.error).toHaveBeenCalledWith(
        '[STORAGE]: ERROR message undefined applying referral for user %s',
        userId,
      );
    });

    it('When a ReferralsNotAvailableError is logged, then it should not log anything', () => {
      const userId = v4();
      const error = new ReferralsNotAvailableError();

      userUseCases.logReferralError(userId, error);

      expect(loggerMock.error).not.toHaveBeenCalled();
    });

    it('When another error is logged, then it should log error message for other errors', () => {
      const userId = v4();
      const errorMessage = 'Some error occurred';

      userUseCases.logReferralError(userId, new Error(errorMessage));

      expect(loggerMock.error).toHaveBeenCalledWith(
        '[STORAGE]: ERROR applying referral for user %s: %s',
        userId,
        errorMessage,
      );
    });

    it('When a non-Error object is logged, Then it should log "Unknown error"', () => {
      const userId = v4();
      const error = 'This is a string error';

      userUseCases.logReferralError(userId, error);

      expect(loggerMock.error).toHaveBeenCalledWith(
        '[STORAGE]: ERROR applying referral for user %s: %s',
        userId,
        'Unknown error',
      );
    });
  });

  describe('areCredentialsCorrect', () => {
    it('When credentials are correct, then it should return true', () => {
      const hashedPass = '$2b$12$qEwggJIve0bWR4GRCb7KXuF0aKi5GI8vfvf';
      const user = newUser();
      user.password = hashedPass;

      const result = userUseCases.areCredentialsCorrect(user, hashedPass);

      expect(result).toEqual(true);
    });

    it('When credentials are not correct, then it should throw', () => {
      const hashedPass = '$2b$12$qEwggJIve0bWR4GRCb7KXuF0aKi5GI8vfvf';
      const user = newUser();
      user.password = hashedPass;

      expect(() =>
        userUseCases.areCredentialsCorrect(user, 'incorrect password'),
      ).toThrow(UnauthorizedException);
    });

    it('When hashed password is null or empty, then it should throw', () => {
      const user = newUser();

      expect(() => userUseCases.areCredentialsCorrect(user, '')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyUserEmail', () => {
    it('When the verificationToken is valid, then it should update the user emailVerified status', async () => {
      const verificationToken = 'validToken';
      const decryptedUuid = v4();

      jest.spyOn(cryptoService, 'decryptText').mockReturnValue(decryptedUuid);
      jest.spyOn(userRepository, 'updateByUuid');

      await userUseCases.verifyUserEmail(verificationToken);

      expect(userRepository.updateByUuid).toHaveBeenCalledWith(decryptedUuid, {
        emailVerified: true,
      });
    });

    it('When the verificationToken is invalid, then it should throw BadRequestException', async () => {
      const verificationToken = 'invalidToken';
      jest.spyOn(cryptoService, 'decryptText').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(
        userUseCases.verifyUserEmail(verificationToken),
      ).rejects.toThrow(BadRequestException);
    });

    it('When the decrypted UUID is not valid, then it should throw BadRequestException', async () => {
      const verificationToken = 'validToken';
      const invalidUuid = 'not-a-uuid';

      jest.spyOn(cryptoService, 'decryptText').mockReturnValue(invalidUuid);

      await expect(
        userUseCases.verifyUserEmail(verificationToken),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendAccountEmailVerification', () => {
    it('When the user has not reached the mail limit, then it should send a verification email', async () => {
      const user = newUser();
      const currentAttemptsCount = 1;
      const mailLimit = newMailLimit({
        attemptsCount: currentAttemptsCount,
        attemptsLimit: 10,
      });

      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mailLimit, false]);
      jest
        .spyOn(cryptoService, 'encryptText')
        .mockReturnValue('encryptedToken');
      jest.spyOn(configService, 'get').mockReturnValue('jwt-secret');
      jest.spyOn(mailerService, 'sendVerifyAccountEmail');
      jest.spyOn(mailLimitRepository, 'updateByUserIdAndMailType');

      await userUseCases.sendAccountEmailVerification(user);

      expect(cryptoService.encryptText).toHaveBeenCalledWith(
        user.uuid,
        expect.any(String),
      );
      expect(
        mailLimitRepository.updateByUserIdAndMailType,
      ).toHaveBeenCalledWith(user.id, MailTypes.EmailVerification, {
        ...mailLimit,
        attemptsCount: currentAttemptsCount + 1,
      });
    });

    it('When the mail limit is reached, then it should throw', async () => {
      const user = newUser();
      const mailLimit = newMailLimit({ attemptsCount: 10, attemptsLimit: 10 });

      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mailLimit, false]);
      jest.spyOn(configService, 'get').mockReturnValue('jwt-secret');

      await expect(
        userUseCases.sendAccountEmailVerification(user),
      ).rejects.toThrow(MailLimitReachedException);
    });

    it('When mail is sent, then it updates email attempts counter', async () => {
      const user = newUser();
      const currentAttemptsCount = 1;
      const mailLimit = newMailLimit({
        attemptsCount: currentAttemptsCount,
        attemptsLimit: 10,
      });

      jest.spyOn(mailLimit, 'increaseTodayAttempts');
      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mailLimit, false]);
      jest
        .spyOn(cryptoService, 'encryptText')
        .mockReturnValue('encryptedToken');
      jest.spyOn(configService, 'get').mockReturnValue('jwt-secret');
      jest.spyOn(mailLimitRepository, 'updateByUserIdAndMailType');

      await userUseCases.sendAccountEmailVerification(user);

      expect(mailLimit.increaseTodayAttempts).toHaveBeenCalled();
      expect(mailLimit.attemptsCount).toEqual(currentAttemptsCount + 1);
      expect(
        mailLimitRepository.updateByUserIdAndMailType,
      ).toHaveBeenCalledWith(user.id, MailTypes.EmailVerification, {
        ...mailLimit,
        attemptsCount: currentAttemptsCount + 1,
      });
    });

    it('When the last email was sent in a different day, then it should reset email attempts', async () => {
      const user = newUser();
      const lastDayDate = new Date();
      lastDayDate.setDate(lastDayDate.getDate() - 1);

      const mailLimit = newMailLimit({
        attemptsCount: 10,
        attemptsLimit: 10,
        lastMailSent: lastDayDate,
      });

      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mailLimit, false]);
      jest
        .spyOn(cryptoService, 'encryptText')
        .mockReturnValue('encryptedToken');
      jest.spyOn(configService, 'get').mockReturnValue('jwt-secret');
      jest.spyOn(mailerService, 'sendVerifyAccountEmail');
      jest.spyOn(mailLimitRepository, 'updateByUserIdAndMailType');

      await userUseCases.sendAccountEmailVerification(user);

      expect(mailLimit.attemptsCount).toEqual(1);
    });
  });

  describe('upsertAvatar', () => {
    const newAvatarKey = v4();
    const newAvatarURL = `http://localhost:9000/${newAvatarKey}`;

    it('When user has an existing avatar then delete the old avatar', async () => {
      const user = newUser({ attributes: { avatar: v4() } });

      jest.spyOn(avatarService, 'deleteAvatar').mockResolvedValue(undefined);
      jest.spyOn(userRepository, 'updateById').mockResolvedValue(undefined);
      jest.spyOn(userUseCases, 'getAvatarUrl').mockResolvedValue(newAvatarURL);

      const result = await userUseCases.upsertAvatar(user, newAvatarKey);

      expect(avatarService.deleteAvatar).toHaveBeenCalledWith(user.avatar);
      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, {
        avatar: newAvatarKey,
      });
      expect(result).toMatchObject({ avatar: newAvatarURL });
    });

    it('When deleting the old avatar fails then throw', async () => {
      jest
        .spyOn(avatarService, 'deleteAvatar')
        .mockRejectedValue(new Error('Delete failed'));

      await expect(
        userUseCases.upsertAvatar(user, newAvatarKey),
      ).rejects.toThrow();
    });

    it('When updating the user avatar fails then throw', async () => {
      jest
        .spyOn(userRepository, 'updateById')
        .mockRejectedValue(new Error('Update failed'));

      await expect(
        userUseCases.upsertAvatar(user, newAvatarKey),
      ).rejects.toThrow();
    });

    it('When user has no avatar already, then previous avatar is not deleted', async () => {
      const user = newUser({ attributes: { avatar: null } });
      jest.spyOn(userRepository, 'updateById').mockResolvedValue();
      jest.spyOn(userUseCases, 'getAvatarUrl').mockResolvedValue(newAvatarURL);

      const result = await userUseCases.upsertAvatar(user, newAvatarKey);

      expect(result).toMatchObject({ avatar: newAvatarURL });
      expect(avatarService.deleteAvatar).not.toHaveBeenCalled();
    });
  });

  describe('deleteAvatar', () => {
    it('When the user has an avatar, then it should delete the avatar and update the user', async () => {
      const user = newUser({ attributes: { avatar: v4() } });

      avatarService.deleteAvatar = jest.fn().mockResolvedValue(undefined);
      userRepository.updateById = jest.fn().mockResolvedValue(undefined);

      await userUseCases.deleteAvatar(user);

      expect(avatarService.deleteAvatar).toHaveBeenCalledWith(user.avatar);
      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, {
        avatar: null,
      });
    });

    it('When the user has no avatar, then it should not delete the avatar and not update the user', async () => {
      const user = newUser({ attributes: { avatar: null } });

      await userUseCases.deleteAvatar(user);

      expect(avatarService.deleteAvatar).not.toHaveBeenCalled();
      expect(userRepository.updateById).not.toHaveBeenCalled();
    });

    it('When deleting the avatar fails, then it should throw', async () => {
      const user = newUser({ attributes: { avatar: v4() } });

      jest
        .spyOn(avatarService, 'deleteAvatar')
        .mockRejectedValue(new Error('Delete failed'));

      await expect(userUseCases.deleteAvatar(user)).rejects.toThrow();
      expect(userRepository.updateById).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('When updating the user profile, then it should call updateByUuid with the correct parameters', async () => {
      const user = newUser();
      const payload: UpdateProfileDto = {
        name: 'John',
        lastname: 'Doe',
      };

      jest.spyOn(userRepository, 'updateByUuid').mockResolvedValue(undefined);

      await userUseCases.updateProfile(user, payload);

      expect(userRepository.updateByUuid).toHaveBeenCalledWith(
        user.uuid,
        payload,
      );
    });
  });

  describe('updatePassword', () => {
    const userKeys = {
      ecc: newKeyServer(),
      kyber: newKeyServer({ encryptVersion: UserKeysEncryptVersions.Kyber }),
    };

    const updatePasswordDto: UpdatePasswordDto = {
      currentPassword: 'currentHashedPassword',
      newPassword: 'newHashedPassword',
      newSalt: 'newSalt',
      mnemonic: 'mnemonic',
      privateKey: 'encryptedPrivateKey',
      privateKyberKey: 'encryptedKyberPrivateKey',
      encryptVersion: UserKeysEncryptVersions.Ecc,
    };

    const fixedSystemCurrentDate = new Date();

    beforeAll(() => {
      jest.useFakeTimers();
      jest.setSystemTime(fixedSystemCurrentDate);
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('When user updates their password, then it should update password and privateKeys successfully', async () => {
      jest
        .spyOn(keyServerUseCases, 'findUserKeys')
        .mockResolvedValueOnce(userKeys);

      await userUseCases.updatePassword(user, updatePasswordDto);

      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, {
        password: updatePasswordDto.newPassword,
        hKey: Buffer.from(updatePasswordDto.newSalt),
        mnemonic: updatePasswordDto.mnemonic,
        lastPasswordChangedAt: fixedSystemCurrentDate,
      });

      expect(
        keyServerUseCases.updateByUserAndEncryptVersion,
      ).toHaveBeenCalledWith(user.id, UserKeysEncryptVersions.Ecc, {
        privateKey: updatePasswordDto.privateKey,
      });
    });

    it('When user with kyber keys tries to update their password but kyber key was not sent, then it should throw', async () => {
      const updatePasswordDtoNoKyber = {
        ...updatePasswordDto,
        privateKyberKey: null,
      };

      jest
        .spyOn(keyServerUseCases, 'findUserKeys')
        .mockResolvedValueOnce(userKeys);

      await expect(
        userUseCases.updatePassword(user, updatePasswordDtoNoKyber),
      ).rejects.toThrow(BadRequestException);
    });

    it('When user updates their password along with new kyber keys, then it should update successfully', async () => {
      await userUseCases.updatePassword(user, updatePasswordDto);

      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, {
        password: updatePasswordDto.newPassword,
        hKey: Buffer.from(updatePasswordDto.newSalt),
        mnemonic: updatePasswordDto.mnemonic,
        lastPasswordChangedAt: fixedSystemCurrentDate,
      });

      expect(
        keyServerUseCases.updateByUserAndEncryptVersion,
      ).toHaveBeenCalledWith(user.id, UserKeysEncryptVersions.Ecc, {
        privateKey: updatePasswordDto.privateKey,
      });
      expect(
        keyServerUseCases.updateByUserAndEncryptVersion,
      ).toHaveBeenCalledWith(user.id, UserKeysEncryptVersions.Kyber, {
        privateKey: updatePasswordDto.privateKyberKey,
      });
    });
  });
  describe('sendDeactivationEmail', () => {
    it('When the user has not reached the deactivation mail limit, then it should send a deactivation email', async () => {
      const user = newUser();
      const currentAttemptsCount = 1;
      const mailLimit = newMailLimit({
        attemptsCount: currentAttemptsCount,
        attemptsLimit: 10,
      });

      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mailLimit, false]);
      jest.spyOn(configService, 'get').mockReturnValue('http://example.com');
      jest.spyOn(bridgeService, 'sendDeactivationEmail');
      jest.spyOn(mailLimit, 'increaseTodayAttempts');
      jest.spyOn(mailLimitRepository, 'updateByUserIdAndMailType');

      await userUseCases.sendDeactivationEmail(user);

      expect(bridgeService.sendDeactivationEmail).toHaveBeenCalledWith(
        user,
        expect.any(String),
        expect.any(String),
      );
      expect(mailLimit.increaseTodayAttempts).toHaveBeenCalled();
      expect(mailLimit.attemptsCount).toEqual(currentAttemptsCount + 1);
      expect(
        mailLimitRepository.updateByUserIdAndMailType,
      ).toHaveBeenCalledWith(user.id, MailTypes.DeactivateUser, {
        ...mailLimit,
        attemptsCount: currentAttemptsCount + 1,
      });
    });

    it('When the deactivation mail limit is reached, then it should throw', async () => {
      const user = newUser();
      const mailLimit = newMailLimit({ attemptsCount: 10, attemptsLimit: 10 });

      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mailLimit, false]);
      jest.spyOn(configService, 'get').mockReturnValue('http://example.com');

      await expect(userUseCases.sendDeactivationEmail(user)).rejects.toThrow(
        MailLimitReachedException,
      );
    });

    it('When deactivation mail is sent, then it updates deactivation email attempts counter', async () => {
      const user = newUser();
      const currentAttemptsCount = 1;
      const mailLimit = newMailLimit({
        attemptsCount: currentAttemptsCount,
        attemptsLimit: 10,
      });

      jest.spyOn(mailLimit, 'increaseTodayAttempts');
      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mailLimit, false]);
      jest.spyOn(configService, 'get').mockReturnValue('http://example.com');

      await userUseCases.sendDeactivationEmail(user);

      expect(mailLimit.increaseTodayAttempts).toHaveBeenCalled();
      expect(mailLimit.attemptsCount).toEqual(currentAttemptsCount + 1);
    });

    it('When the last deactivation email was sent on a different day, then it should reset email attempts', async () => {
      const user = newUser();
      const lastDayDate = new Date();
      lastDayDate.setDate(lastDayDate.getDate() - 1);

      const mailLimit = newMailLimit({
        attemptsCount: 10,
        attemptsLimit: 10,
        lastMailSent: lastDayDate,
      });

      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mailLimit, false]);
      jest.spyOn(configService, 'get').mockReturnValue('http://example.com');

      await userUseCases.sendDeactivationEmail(user);

      expect(mailLimit.attemptsCount).toEqual(1);
    });
  });

  describe('confirmDeactivation', () => {
    const mockUser = newUser();

    it('When the token is not for a valid user, then it should throw', async () => {
      const invalidEmail = 'test@test.com';
      jest
        .spyOn(bridgeService, 'confirmDeactivation')
        .mockResolvedValueOnce(invalidEmail);
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce(null);

      await expect(
        userUseCases.confirmDeactivation('invalid-token'),
      ).rejects.toThrow(BadRequestException);
      expect(userRepository.findByEmail).toHaveBeenCalledWith(invalidEmail);
    });

    it('When user is deactivated successfully, then all related resources should be deleted', async () => {
      jest
        .spyOn(bridgeService, 'confirmDeactivation')
        .mockResolvedValueOnce(mockUser.email);
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce(mockUser);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(mockUser);
      jest
        .spyOn(userRepository, 'updateByUuid')
        .mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'deleteBy').mockResolvedValueOnce(undefined);
      jest
        .spyOn(keyServerRepository, 'deleteByUserId')
        .mockResolvedValueOnce(undefined);
      jest
        .spyOn(appSumoUseCases, 'deleteByUserId')
        .mockResolvedValueOnce(undefined);
      jest
        .spyOn(backupUseCases, 'deleteUserBackups')
        .mockResolvedValueOnce(undefined);
      jest.spyOn(folderUseCases, 'removeUserOrphanFolders');

      await expect(
        userUseCases.confirmDeactivation('valid-token'),
      ).resolves.not.toThrow();

      expect(userRepository.findByEmail).toHaveBeenCalledWith(mockUser.email);
      expect(userRepository.updateByUuid).toHaveBeenCalledWith(mockUser.uuid, {
        rootFolderId: null,
      });
      expect(userRepository.deleteBy).toHaveBeenCalledWith({
        uuid: mockUser.uuid,
      });
      expect(keyServerRepository.deleteByUserId).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(appSumoUseCases.deleteByUserId).toHaveBeenCalledWith(mockUser.id);
      expect(backupUseCases.deleteUserBackups).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(folderUseCases.removeUserOrphanFolders).toHaveBeenCalledWith(
        mockUser,
      );
    });

    it('When an error occurs during deactivation, then the user is renamed and the error is thrown', async () => {
      jest
        .spyOn(bridgeService, 'confirmDeactivation')
        .mockResolvedValueOnce(mockUser.email);
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce(mockUser);
      jest.spyOn(userRepository, 'updateBy');
      jest
        .spyOn(keyServerRepository, 'deleteByUserId')
        .mockRejectedValue(new Error('Deletion error'));

      await expect(
        userUseCases.confirmDeactivation('bad-token'),
      ).rejects.toThrow();
      expect(userRepository.updateBy).toHaveBeenCalledWith(
        { uuid: mockUser.uuid },
        expect.objectContaining({ email: expect.stringMatching(/-DELETED$/) }),
      );
      expect(keyServerRepository.deleteByUserId).toHaveBeenCalledWith(
        mockUser.id,
      );
    });
  });

  describe('canUserExpandStorage', () => {
    const userMock = newUser();

    it('When the user has enough space left, then it should return canExpand as true', async () => {
      const userCurrentStorage = convertSizeToBytes(50, 'TB');

      jest
        .spyOn(bridgeService, 'getLimit')
        .mockResolvedValue(userCurrentStorage);

      const result = await userUseCases.canUserExpandStorage(
        userMock,
        convertSizeToBytes(20, 'TB'),
      );

      expect(result).toEqual({
        canExpand: true,
        currentMaxSpaceBytes: userCurrentStorage,
        expandableBytes: convertSizeToBytes(50, 'TB'),
      });
    });

    it('When the user has reached the maximum storage limit, then it should return canExpand as false', async () => {
      const userCurrentStorage = convertSizeToBytes(100, 'TB');

      jest
        .spyOn(bridgeService, 'getLimit')
        .mockResolvedValue(userCurrentStorage);

      const result = await userUseCases.canUserExpandStorage(
        userMock,
        convertSizeToBytes(20, 'MB'),
      );

      expect(result).toEqual({
        canExpand: false,
        currentMaxSpaceBytes: userCurrentStorage,
        expandableBytes: 0,
      });
    });

    it('When the user is just below the maximum storage limit, then it should return canExpand as true', async () => {
      const userCurrentStorage = convertSizeToBytes(99, 'TB');

      jest
        .spyOn(bridgeService, 'getLimit')
        .mockResolvedValue(userCurrentStorage);

      const result = await userUseCases.canUserExpandStorage(
        userMock,
        convertSizeToBytes(1, 'TB'),
      );

      expect(result).toEqual({
        canExpand: true,
        currentMaxSpaceBytes: userCurrentStorage,
        expandableBytes: convertSizeToBytes(1, 'TB'),
      });
    });

    it('When no additional space is requested, then it should return canExpand based only on the current usage', async () => {
      const userCurrentStorage = convertSizeToBytes(20, 'TB');

      jest
        .spyOn(bridgeService, 'getLimit')
        .mockResolvedValue(userCurrentStorage);

      const result = await userUseCases.canUserExpandStorage(userMock);

      expect(result).toEqual({
        canExpand: true,
        currentMaxSpaceBytes: userCurrentStorage,
        expandableBytes: convertSizeToBytes(80, 'TB'),
      });
    });
  });

  describe('getOrCreateUserRootFolderAndBucket', () => {
    const user = newUser();
    const rootFolder = newFolder();
    rootFolder.userId = user.id;
    const bucket = {
      id: 'bucket-123',
      name: 'user-bucket',
      user: user.userId,
      encryptionKey: 'encryption-key',
      publicPermissions: [],
      created: new Date().toISOString(),
      maxFrameSize: 1024,
      pubkeys: [],
      transfer: 0,
      storage: 0,
    };

    it('When root folder exists, then it should return the folder without creating a new one', async () => {
      jest.spyOn(folderUseCases, 'getFolder').mockResolvedValueOnce(rootFolder);

      const result =
        await userUseCases.getOrCreateUserRootFolderAndBucket(user);

      expect(folderUseCases.getFolder).toHaveBeenCalledWith(user.rootFolderId);
      expect(bridgeService.createBucket).not.toHaveBeenCalled();
      expect(result).toEqual(rootFolder);
    });

    it('When root folder does not exist, then it should create a new bucket and folder', async () => {
      jest.spyOn(folderUseCases, 'getFolder').mockResolvedValueOnce(null);

      jest.spyOn(bridgeService, 'createBucket').mockResolvedValueOnce(bucket);
      jest
        .spyOn(userUseCases, 'createInitialFolders')
        .mockResolvedValueOnce([rootFolder, newFolder(), newFolder()]);

      const result =
        await userUseCases.getOrCreateUserRootFolderAndBucket(user);

      expect(folderUseCases.getFolder).toHaveBeenCalledWith(user.rootFolderId);
      expect(bridgeService.createBucket).toHaveBeenCalledWith(
        user.username,
        user.userId,
      );
      expect(userUseCases.createInitialFolders).toHaveBeenCalledWith(
        user,
        bucket.id,
      );
      expect(result).toEqual(rootFolder);
    });
  });

  describe('createUser', () => {
    const decryptedPassword = 'decrypted-password-hash';
    const password = 'encrypted-password-hash';
    const decryptedSalt = 'decrypted-salt';
    const salt = 'encrypted-salt';
    const networkPass = 'network-pass';
    const bucketId = 'bucket-id';

    const userMock = newUser({
      attributes: {
        password: decryptedPassword,
        hKey: decryptedSalt,
        userId: networkPass,
      },
    });

    it('When user already exists, then it should throw', async () => {
      const existentUser = newUser();

      jest
        .spyOn(userRepository, 'findByUsername')
        .mockResolvedValue(existentUser);

      await expect(
        userUseCases.createUser({ ...existentUser, salt }),
      ).rejects.toThrow(UserAlreadyRegisteredError);

      expect(bridgeService.createUser).not.toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('When creating a user successfully, then should return user data', async () => {
      const rootFolder = newFolder();

      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(null);
      jest.spyOn(cryptoService, 'decryptText').mockImplementation((text) => {
        if (text === password) return decryptedPassword;
        if (text === salt) return decryptedSalt;
        return '';
      });
      jest
        .spyOn(bridgeService, 'createUser')
        .mockResolvedValue({ userId: networkPass, uuid: user.uuid });
      jest.spyOn(userRepository, 'create').mockResolvedValue(userMock);
      jest
        .spyOn(bridgeService, 'createBucket')
        .mockResolvedValue({ id: bucketId } as any);
      jest
        .spyOn(userUseCases, 'createInitialFolders')
        .mockResolvedValue([rootFolder, newFolder(), newFolder()]);

      jest.spyOn(configService, 'get').mockReturnValue('jwt-secret');
      jest
        .spyOn(userUseCases, 'getNewTokenPayload')
        .mockReturnValue({ uuid: userMock.uuid } as any);

      const result = await userUseCases.createUser({
        email: userMock.email,
        password,
        salt,
        name: userMock.name,
        mnemonic: 'mnemonic',
        lastname: userMock.lastname,
      });

      expect(userRepository.findByUsername).toHaveBeenCalledWith(
        userMock.email,
      );
      expect(bridgeService.createUser).toHaveBeenCalledWith(userMock.email);
      expect(bridgeService.createBucket).toHaveBeenCalledWith(
        userMock.email,
        networkPass,
      );

      expect(userUseCases.createInitialFolders).toHaveBeenCalledWith(
        userMock,
        bucketId,
      );

      expect(result).toEqual({
        token: expect.any(String),
        newToken: expect.any(String),
        user: expect.objectContaining({
          rootFolderId: rootFolder.id,
          rootFolderUuid: rootFolder.uuid,
          bucket: bucketId,
          uuid: user.uuid,
          userId: networkPass,
          hasReferralsProgram: false,
        }),
        uuid: user.uuid,
      });
    });

    it('When error occurs after user creation, then should rollback and notify', async () => {
      const bucketError = new Error('Bucket creation failed');

      jest.spyOn(userRepository, 'findByUsername').mockResolvedValueOnce(null);
      jest.spyOn(userRepository, 'create').mockResolvedValueOnce(userMock);
      jest.spyOn(cryptoService, 'decryptText').mockImplementation((text) => {
        if (text === password) return decryptedPassword;
        if (text === salt) return decryptedSalt;
        return '';
      });
      jest
        .spyOn(bridgeService, 'createUser')
        .mockResolvedValueOnce({ userId: networkPass, uuid: userMock.uuid });
      jest.spyOn(bridgeService, 'createBucket').mockRejectedValue(bucketError);

      await expect(
        userUseCases.createUser({
          email: userMock.email,
          password,
          salt,
          name: userMock.name,
          mnemonic: 'mnemonic',
          lastname: userMock.lastname,
        }),
      ).rejects.toThrow(bucketError);

      expect(loggerMock.error).toHaveBeenCalled();
      expect(loggerMock.warn).toHaveBeenCalled();

      expect(userRepository.deleteBy).toHaveBeenCalledWith({
        uuid: userMock.uuid,
      });
    });
  });

  describe('getUserUsage', () => {
    it('When cache has user usage data, then it should return the cached data', async () => {
      const cachedUsage = { usage: 1024 };
      const backupUsage = 1024;
      const totalUsage = cachedUsage.usage + backupUsage;

      jest
        .spyOn(cacheManagerService, 'getUserUsage')
        .mockResolvedValue(cachedUsage);
      jest.spyOn(fileUseCases, 'getUserUsedStorage');
      jest.spyOn(cacheManagerService, 'setUserUsage');
      jest
        .spyOn(backupUseCases, 'sumExistentBackupSizes')
        .mockResolvedValue(backupUsage);

      const result = await userUseCases.getUserUsage(user);

      expect(cacheManagerService.getUserUsage).toHaveBeenCalledWith(user.uuid);
      expect(fileUseCases.getUserUsedStorage).not.toHaveBeenCalled();
      expect(cacheManagerService.setUserUsage).not.toHaveBeenCalled();
      expect(result).toEqual({
        drive: cachedUsage.usage,
        backup: backupUsage,
        total: totalUsage,
      });
    });

    it('When cache does not have user usage data, then it should get data from database and cache it', async () => {
      const driveUsage = 2048;
      const backupUsage = 1024;
      const totalUsage = driveUsage + backupUsage;
      jest.spyOn(cacheManagerService, 'getUserUsage').mockResolvedValue(null);
      jest
        .spyOn(fileUseCases, 'getUserUsedStorage')
        .mockResolvedValue(driveUsage);
      jest
        .spyOn(cacheManagerService, 'setUserUsage')
        .mockResolvedValue(undefined);
      jest
        .spyOn(backupUseCases, 'sumExistentBackupSizes')
        .mockResolvedValue(backupUsage);

      const result = await userUseCases.getUserUsage(user);

      expect(cacheManagerService.getUserUsage).toHaveBeenCalledWith(user.uuid);
      expect(fileUseCases.getUserUsedStorage).toHaveBeenCalledWith(user);
      expect(cacheManagerService.setUserUsage).toHaveBeenCalledWith(
        user.uuid,
        driveUsage,
      );
      expect(result).toEqual({
        drive: driveUsage,
        backup: backupUsage,
        total: totalUsage,
      });
    });
  });

  describe('updateUserStorage', () => {
    const newStorage = 1024;
    it('When called, then it should set user new storage', async () => {
      await userUseCases.updateUserStorage(user, newStorage);

      expect(bridgeService.setStorage).toHaveBeenCalledWith(
        user.username,
        newStorage,
      );
    });
  });

  describe('getSpaceLimit', () => {
    it('When a valid user is provided, then it should return the space limit', async () => {
      const expectedLimit = 1000000000;
      jest
        .spyOn(cacheManagerService, 'getUserStorageLimit')
        .mockResolvedValue(null);
      jest.spyOn(bridgeService, 'getLimit').mockResolvedValue(expectedLimit);

      const result = await userUseCases.getSpaceLimit(user);

      expect(bridgeService.getLimit).toHaveBeenCalledWith(
        user.bridgeUser,
        user.userId,
      );
      expect(result).toEqual(expectedLimit);
    });

    it('When limit is cached, then it should return the cached space limit', async () => {
      const expectedLimit = 1000000000;
      jest
        .spyOn(cacheManagerService, 'getUserStorageLimit')
        .mockResolvedValue({ limit: expectedLimit });

      jest.spyOn(bridgeService, 'getLimit').mockResolvedValue(expectedLimit);

      const result = await userUseCases.getSpaceLimit(user);

      expect(bridgeService.getLimit).not.toHaveBeenCalled();
      expect(result).toEqual(expectedLimit);
    });

    it('When an error occurs while getting the space limit, then it should throw an error', async () => {
      const errorMessage = 'Error getting space limit';
      jest
        .spyOn(cacheManagerService, 'getUserStorageLimit')
        .mockResolvedValue(null);
      jest
        .spyOn(bridgeService, 'getLimit')
        .mockRejectedValue(new Error(errorMessage));

      await expect(userUseCases.getSpaceLimit(user)).rejects.toThrow(
        errorMessage,
      );
    });
  });

  describe('replacePreCreatedUser', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    it('When pre-created user does not exist, then do nothing', async () => {
      jest
        .spyOn(preCreatedUsersRepository, 'findByUsername')
        .mockResolvedValue(null);

      await userUseCases.replacePreCreatedUser(
        'non-existent-email',
        'new-user-uuid',
        'new-public-key',
        'new-public-kyber-key',
      );

      expect(preCreatedUsersRepository.findByUsername).toHaveBeenCalled();
      expect(sharingRepository.getInvitesBySharedwith).not.toHaveBeenCalled();
      expect(sharingRepository.bulkUpdate).not.toHaveBeenCalled();
      expect(preCreatedUsersRepository.deleteByUuid).not.toHaveBeenCalled();
    });

    it('When pre-created user exists, then replace invitations with new user keys and uuid', async () => {
      const preCreatedUser = newPreCreatedUser();
      const newUserUuid = v4();

      const newPublicKey = 'new-public-key';
      const newPublicKyberKey = 'new-public-kyber-key';
      const preCreatedUserDecryptedKey = 'decrypted-private-key';
      const preCreatedUserDecryptedKyberKey = 'decrypted-private-kyber-key';

      const sharingDecryptedEccKey = 'decrypted-encryption-key-ecc';
      const sharingDecryptedHybridKey = 'decrypted-encryption-key-hybrid';
      const newSharingEncryptedEccKey = 'new-encrypted-encryption-key-ecc';
      const newSharingEncryptedHybridKey =
        'new-encrypted-encryption-key-hybrid';

      const invites: SharingInvite[] = [
        SharingInvite.build({
          id: v4(),
          type: 'OWNER',
          roleId: v4(),
          createdAt: new Date(),
          updatedAt: new Date(),
          encryptionAlgorithm: 'ecc',
          encryptionKey: 'encrypted-key-1',
          sharedWith: preCreatedUser.uuid,
          itemId: v4(),
          itemType: 'file',
        }),
        SharingInvite.build({
          id: v4(),
          type: 'OWNER',
          roleId: v4(),
          createdAt: new Date(),
          updatedAt: new Date(),
          encryptionAlgorithm: 'hybrid',
          encryptionKey: 'encrypted-key-1',
          sharedWith: preCreatedUser.uuid,
          itemId: v4(),
          itemType: 'file',
        }),
      ];
      jest
        .spyOn(preCreatedUsersRepository, 'findByUsername')
        .mockResolvedValueOnce(preCreatedUser);

      jest.spyOn(configService, 'get').mockReturnValueOnce('default-pass');
      jest
        .spyOn(aes, 'decrypt')
        .mockReturnValueOnce(preCreatedUserDecryptedKey)
        .mockReturnValueOnce(preCreatedUserDecryptedKyberKey);
      jest
        .spyOn(sharingRepository, 'getInvitesBySharedwith')
        .mockResolvedValueOnce(invites);
      jest
        .spyOn(
          asymmetricEncryptionService,
          'hybridDecryptMessageWithPrivateKey',
        )
        .mockResolvedValueOnce(sharingDecryptedEccKey)
        .mockResolvedValueOnce(sharingDecryptedHybridKey);

      jest
        .spyOn(asymmetricEncryptionService, 'hybridEncryptMessageWithPublicKey')
        .mockResolvedValueOnce(newSharingEncryptedEccKey)
        .mockResolvedValueOnce(newSharingEncryptedHybridKey);
      jest.spyOn(sharingRepository, 'bulkUpdate');
      jest.spyOn(userUseCases, 'replacePreCreatedUserWorkspaceInvitations');
      jest.spyOn(preCreatedUsersRepository, 'deleteByUuid');

      await userUseCases.replacePreCreatedUser(
        preCreatedUser.email,
        newUserUuid,
        newPublicKey,
        newPublicKyberKey,
      );

      expect(preCreatedUsersRepository.findByUsername).toHaveBeenCalledWith(
        preCreatedUser.email,
      );
      expect(sharingRepository.getInvitesBySharedwith).toHaveBeenCalledWith(
        preCreatedUser.uuid,
      );

      expect(sharingRepository.bulkUpdate).toHaveBeenCalledWith([
        expect.objectContaining({
          encryptionKey: newSharingEncryptedEccKey,
          sharedWith: newUserUuid,
        }),
        expect.objectContaining({
          encryptionKey: newSharingEncryptedHybridKey,
          sharedWith: newUserUuid,
        }),
      ]);

      expect(
        userUseCases.replacePreCreatedUserWorkspaceInvitations,
      ).toHaveBeenCalledWith(
        preCreatedUser.uuid,
        newUserUuid,
        preCreatedUserDecryptedKey,
        newPublicKey,
      );
      expect(preCreatedUsersRepository.deleteByUuid).toHaveBeenCalledWith(
        preCreatedUser.uuid,
      );
    });

    it('When invitation is hybrid and no public Kyber key is provided, then delete the invitation', async () => {
      const preCreatedUser = newPreCreatedUser();
      const newUserUuid = v4();

      const newPublicKey = 'new-public-key';
      const preCreatedUserDecryptedKey = 'decrypted-private-key';

      const invites: SharingInvite[] = [
        SharingInvite.build({
          id: v4(),
          type: 'OWNER',
          roleId: v4(),
          createdAt: new Date(),
          updatedAt: new Date(),
          encryptionAlgorithm: 'hybrid',
          encryptionKey: 'encrypted-key-1',
          sharedWith: preCreatedUser.uuid,
          itemId: v4(),
          itemType: 'file',
        }),
      ];

      jest
        .spyOn(preCreatedUsersRepository, 'findByUsername')
        .mockResolvedValueOnce(preCreatedUser);

      jest.spyOn(configService, 'get').mockReturnValueOnce('default-pass');
      jest
        .spyOn(aes, 'decrypt')
        .mockReturnValueOnce(preCreatedUserDecryptedKey)
        .mockReturnValueOnce(null);
      jest
        .spyOn(sharingRepository, 'getInvitesBySharedwith')
        .mockResolvedValueOnce(invites);

      jest.spyOn(sharingRepository, 'deleteInvite');

      await userUseCases.replacePreCreatedUser(
        preCreatedUser.email,
        newUserUuid,
        newPublicKey,
      );

      expect(sharingRepository.deleteInvite).toHaveBeenCalledWith(invites[0]);
      expect(sharingRepository.bulkUpdate).toHaveBeenCalledWith([]);
    });

    it('When invitation is hybrid and new generated public kyber key is provided but pre created user does not have kyber keys, then delete the invitation', async () => {
      const preCreatedUser = newPreCreatedUser();
      preCreatedUser.publicKyberKey = null;
      preCreatedUser.privateKyberKey = null;

      const newUserUuid = v4();

      const newPublicKyberKey = 'new-public-kyber-key';
      const newPublicKey = 'new-public-key';
      const preCreatedUserDecryptedKey = 'decrypted-private-key';

      const invites: SharingInvite[] = [
        SharingInvite.build({
          id: v4(),
          type: 'OWNER',
          roleId: v4(),
          createdAt: new Date(),
          updatedAt: new Date(),
          encryptionAlgorithm: 'hybrid',
          encryptionKey: 'encrypted-key-1',
          sharedWith: preCreatedUser.uuid,
          itemId: v4(),
          itemType: 'file',
        }),
      ];

      jest
        .spyOn(preCreatedUsersRepository, 'findByUsername')
        .mockResolvedValueOnce(preCreatedUser);

      jest.spyOn(configService, 'get').mockReturnValueOnce('default-pass');
      jest
        .spyOn(aes, 'decrypt')
        .mockReturnValueOnce(preCreatedUserDecryptedKey)
        .mockReturnValueOnce(null);
      jest
        .spyOn(sharingRepository, 'getInvitesBySharedwith')
        .mockResolvedValueOnce(invites);

      jest.spyOn(sharingRepository, 'deleteInvite');

      await userUseCases.replacePreCreatedUser(
        preCreatedUser.email,
        newUserUuid,
        newPublicKey,
        newPublicKyberKey,
      );

      expect(sharingRepository.deleteInvite).toHaveBeenCalledWith(invites[0]);
      expect(sharingRepository.bulkUpdate).toHaveBeenCalledWith([]);
    });

    it('When pre created user is replaced, then sharing invitations encrypted keys should match original message if decrypted with new asymmetric keys', async () => {
      const [preCreatedKeys, newKeys] = await Promise.all([
        asymmetricEncryptionService.generateNewKeys(),
        asymmetricEncryptionService.generateNewKeys(),
      ]);
      const newUserUuid = v4();
      const preCreatedUser = newPreCreatedUser();
      preCreatedUser.publicKey = preCreatedKeys.publicKeyArmored;
      preCreatedUser.publicKyberKey = preCreatedKeys.publicKyberKeyBase64;

      const sharingDecryptedKey =
        'until bonus summer risk chunk oyster census ability frown win pull steel measure employ rigid improve riot remind system earn inch broken chalk clip';

      const invites: SharingInvite[] = [
        SharingInvite.build({
          id: v4(),
          type: 'OWNER',
          roleId: v4(),
          createdAt: new Date(),
          updatedAt: new Date(),
          encryptionAlgorithm: 'ecc',
          encryptionKey:
            await asymmetricEncryptionService.hybridEncryptMessageWithPublicKey(
              {
                message: sharingDecryptedKey,
                publicKeyInBase64: preCreatedKeys.publicKeyArmored,
              },
            ),
          sharedWith: preCreatedUser.uuid,
          itemId: v4(),
          itemType: 'file',
        }),
        SharingInvite.build({
          id: v4(),
          type: 'OWNER',
          roleId: v4(),
          createdAt: new Date(),
          updatedAt: new Date(),
          encryptionAlgorithm: 'hybrid',
          encryptionKey:
            await asymmetricEncryptionService.hybridEncryptMessageWithPublicKey(
              {
                message: sharingDecryptedKey,
                publicKeyInBase64: preCreatedKeys.publicKeyArmored,
                publicKyberKeyBase64: preCreatedKeys.publicKyberKeyBase64,
              },
            ),
          sharedWith: preCreatedUser.uuid,
          itemId: v4(),
          itemType: 'file',
        }),
      ];

      jest
        .spyOn(preCreatedUsersRepository, 'findByUsername')
        .mockResolvedValueOnce(preCreatedUser);
      jest.spyOn(configService, 'get').mockReturnValueOnce('default-pass');
      jest
        .spyOn(aes, 'decrypt')
        .mockReturnValueOnce(preCreatedKeys.privateKeyArmored)
        .mockReturnValueOnce(preCreatedKeys.privateKyberKeyBase64);
      jest
        .spyOn(sharingRepository, 'getInvitesBySharedwith')
        .mockResolvedValueOnce(invites);

      jest.spyOn(sharingRepository, 'bulkUpdate');
      jest.spyOn(userUseCases, 'replacePreCreatedUserWorkspaceInvitations');
      jest.spyOn(preCreatedUsersRepository, 'deleteByUuid');

      await userUseCases.replacePreCreatedUser(
        preCreatedUser.email,
        newUserUuid,
        newKeys.publicKeyArmored,
        newKeys.publicKyberKeyBase64,
      );

      const newInviteEccEncryptedKey =
        await asymmetricEncryptionService.hybridDecryptMessageWithPrivateKey({
          encryptedMessageInBase64: invites[0].encryptionKey,
          privateKeyInBase64: newKeys.privateKeyArmored,
        });
      const newInviteHybridEncryptedKey =
        await asymmetricEncryptionService.hybridDecryptMessageWithPrivateKey({
          encryptedMessageInBase64: invites[1].encryptionKey,
          privateKeyInBase64: newKeys.privateKeyArmored,
          privateKyberKeyInBase64: newKeys.privateKyberKeyBase64,
        });

      expect(newInviteHybridEncryptedKey).toEqual(sharingDecryptedKey);
      expect(newInviteEccEncryptedKey).toEqual(sharingDecryptedKey);
    }, 10000);
  });

  describe('updateCredentials', () => {
    const mockUser = newUser();
    const mockCredentials = {
      mnemonic: 'encrypted_mnemonic',
      password: 'encrypted_password',
      salt: 'encrypted_salt',
      privateKeys: {
        ecc: 'encrypted_ecc_key',
        kyber: 'encrypted_kyber_key',
      },
    };

    const decryptedPassword = 'decrypted_password';
    const decryptedSalt = 'decrypted_salt';

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(cryptoService, 'decryptText').mockImplementation((text) => {
        if (text === mockCredentials.password) return decryptedPassword;
        if (text === mockCredentials.salt) return decryptedSalt;
        return text;
      });
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(mockUser);
      jest.spyOn(userRepository, 'updateByUuid').mockResolvedValue(undefined);
      jest.spyOn(userUseCases, 'resetUser').mockResolvedValue(undefined);
    });

    it('When updating credentials without reset and private keys, then it should update user and keys', async () => {
      await userUseCases.updateCredentials(mockUser.uuid, mockCredentials);

      expect(userRepository.updateByUuid).toHaveBeenCalledWith(mockUser.uuid, {
        mnemonic: mockCredentials.mnemonic,
        password: decryptedPassword,
        hKey: decryptedSalt,
      });

      expect(
        keyServerUseCases.updateByUserAndEncryptVersion,
      ).toHaveBeenCalledWith(mockUser.id, UserKeysEncryptVersions.Ecc, {
        privateKey: mockCredentials.privateKeys.ecc,
      });

      expect(
        keyServerUseCases.updateByUserAndEncryptVersion,
      ).toHaveBeenCalledWith(mockUser.id, UserKeysEncryptVersions.Kyber, {
        privateKey: mockCredentials.privateKeys.kyber,
      });

      expect(userUseCases.resetUser).not.toHaveBeenCalled();
    });

    it('When updating credentials with reset, then it should reset user data', async () => {
      await userUseCases.updateCredentials(
        mockUser.uuid,
        mockCredentials,
        true,
      );

      expect(userRepository.updateByUuid).toHaveBeenCalledWith(mockUser.uuid, {
        mnemonic: mockCredentials.mnemonic,
        password: decryptedPassword,
        hKey: decryptedSalt,
      });

      expect(userUseCases.resetUser).toHaveBeenCalledWith(mockUser, {
        deleteFiles: true,
        deleteFolders: true,
        deleteShares: true,
        deleteWorkspaces: true,
        deleteBackups: true,
      });
    });

    it('When updating credentials without reset but privateKeys are missing, then it should throw', async () => {
      const credentialsWithoutKeys = {
        ...mockCredentials,
        privateKeys: null,
      };

      await expect(
        userUseCases.updateCredentials(
          mockUser.uuid,
          credentialsWithoutKeys,
          false,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateCredentialsOld', () => {
    const mockUser = newUser();
    const mockCredentials = {
      mnemonic: 'encrypted_mnemonic',
      password: 'encrypted_password',
      salt: 'encrypted_salt',
      privateKey: 'encrypted_private_key',
    };

    const decryptedPassword = 'decrypted_password';
    const decryptedSalt = 'decrypted_salt';

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(cryptoService, 'decryptText').mockImplementation((text) => {
        if (text === mockCredentials.password) return decryptedPassword;
        if (text === mockCredentials.salt) return decryptedSalt;
        return text;
      });
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(mockUser);
      jest.spyOn(userRepository, 'updateByUuid').mockResolvedValue(undefined);
      jest.spyOn(userUseCases, 'resetUser').mockResolvedValue(undefined);
      jest
        .spyOn(keyServerRepository, 'deleteByUserId')
        .mockResolvedValue(undefined);
    });

    it('When updating credentials without reset, then it should update user and delete keys', async () => {
      await userUseCases.updateCredentialsOld(mockUser.uuid, mockCredentials);

      expect(userRepository.updateByUuid).toHaveBeenCalledWith(mockUser.uuid, {
        mnemonic: mockCredentials.mnemonic,
        password: decryptedPassword,
        hKey: decryptedSalt,
      });

      expect(keyServerRepository.deleteByUserId).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(userUseCases.resetUser).not.toHaveBeenCalled();
    });

    it('When updating credentials with reset, then it should reset user data', async () => {
      await userUseCases.updateCredentialsOld(
        mockUser.uuid,
        mockCredentials,
        true,
      );

      expect(userRepository.updateByUuid).toHaveBeenCalledWith(mockUser.uuid, {
        mnemonic: mockCredentials.mnemonic,
        password: decryptedPassword,
        hKey: decryptedSalt,
      });

      expect(userUseCases.resetUser).toHaveBeenCalledWith(mockUser, {
        deleteFiles: true,
        deleteFolders: true,
        deleteShares: true,
        deleteWorkspaces: true,
        deleteBackups: true,
      });

      expect(keyServerRepository.deleteByUserId).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('When updating credentials without private key, then it should still work', async () => {
      const credentialsWithoutPrivateKey = {
        mnemonic: mockCredentials.mnemonic,
        password: mockCredentials.password,
        salt: mockCredentials.salt,
      };

      await userUseCases.updateCredentialsOld(
        mockUser.uuid,
        credentialsWithoutPrivateKey,
      );

      expect(userRepository.updateByUuid).toHaveBeenCalledWith(mockUser.uuid, {
        mnemonic: mockCredentials.mnemonic,
        password: decryptedPassword,
        hKey: decryptedSalt,
      });

      expect(keyServerRepository.deleteByUserId).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(userUseCases.resetUser).not.toHaveBeenCalled();
    });

    it('When user is not found, then it should find user after update', async () => {
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(mockUser);

      await userUseCases.updateCredentialsOld(mockUser.uuid, mockCredentials);

      expect(userRepository.findByUuid).toHaveBeenCalledWith(mockUser.uuid);
      expect(keyServerRepository.deleteByUserId).toHaveBeenCalledWith(
        mockUser.id,
      );
    });
  });

  describe('verifyAndDecodeAccountRecoveryToken', () => {
    it('When token is valid, then it should return the user UUID', () => {
      const userUuid = v4();
      const token = 'validToken';
      const decodedToken = {
        payload: {
          uuid: userUuid,
          action: 'recover-account',
        },
      };

      const verifyTokenSpy = jest
        .spyOn(jwtLibrary, 'verifyToken')
        .mockReturnValue(decodedToken);

      const result = userUseCases.verifyAndDecodeAccountRecoveryToken(token);

      expect(result).toEqual({ userUuid });
      expect(verifyTokenSpy).toHaveBeenCalledWith(token, getEnv().secrets.jwt);
    });

    it('When token verification returns a string, then it should throw ForbiddenException', () => {
      const token = 'invalidToken';

      jest.spyOn(jwtLibrary, 'verifyToken').mockReturnValue(token);
      expect(() =>
        userUseCases.verifyAndDecodeAccountRecoveryToken(token),
      ).toThrow(ForbiddenException);
    });

    it('When decoded content is missing, then it should throw ForbiddenException', () => {
      const token = 'invalidToken';
      const decodedToken = { payload: null };

      jest.spyOn(jwtLibrary, 'verifyToken').mockReturnValue(decodedToken);

      expect(() =>
        userUseCases.verifyAndDecodeAccountRecoveryToken(token),
      ).toThrow(ForbiddenException);
    });

    it('When token verification throws JsonWebTokenError, then it should throw ForbiddenException with "Invalid token"', () => {
      const token = 'invalidToken';
      const error = new JsonWebTokenError('Invalid token');

      jest.spyOn(jwtLibrary, 'verifyToken').mockImplementation(() => {
        throw error;
      });

      expect(() =>
        userUseCases.verifyAndDecodeAccountRecoveryToken(token),
      ).toThrow(new ForbiddenException('Invalid token'));
    });
  });

  describe('recoverAccountLegacy', () => {
    const user = newUser();
    const decryptedPasswordHash =
      '76b022e345d5c884cf4e77ed42e50ed8a385b70c2642b064f53ef670788a5ef2';
    const plainMnemonic =
      'accident direct sustain stomach various squirrel cannon drama risk illness caught claw spirit noodle pyramid poverty dragon strong chimney bullet giraffe ladder bacon coil';
    const mnemonicEncryptedWithPassword =
      'Rszx7x6iVQDS6cU3+qBwvx3ON2czERCJX+g21EGPT5ElGbTpB+6d2bwAN4bFS3sB1NDRXpaOfx4DJjxDg053P+4VF6AIbD8TWaSnzSCBD8xkbmfUmu7b4oK4Xt7IpFyhlmVtMQjEeaQopFJ0FxyI0aVj9znLrnEdwmjN67r4YYn6LbvC9XgoeTHVczKGhSb6ZJZUWdX5eWwG973KmZ83xjrYYYd/hvSt6oDa27iKVlq1CfI6r2fEz00J4QG0oBsvY+67Ta+zaTubJl+zA30fCfISClbvgZ/f/8WUtqr9eC/BxJx8kPQnldrTDXzkrDpHZp8Vu1C/mE3vQhxOmR915E77l/yr9Kx2dnM4';
    const decryptedSalt = 'd06713f9540fd33793a2623c821b8969';
    let newCredentials: LegacyRecoverAccountDto;

    beforeEach(async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        providers: [UserUseCases],
        imports: [CryptoModule, AsymmetricEncryptionModule],
      })
        .useMocker(() => createMock())
        .compile();

      userUseCases = moduleRef.get<UserUseCases>(UserUseCases);
      userRepository = moduleRef.get<SequelizeUserRepository>(
        SequelizeUserRepository,
      );
      keyServerUseCases = moduleRef.get<KeyServerUseCases>(KeyServerUseCases);
      cryptoService = moduleRef.get<CryptoService>(CryptoService);
      workspaceRepository = moduleRef.get<SequelizeWorkspaceRepository>(
        SequelizeWorkspaceRepository,
      );
      asymmetricEncryptionService = moduleRef.get<AsymmetricEncryptionService>(
        AsymmetricEncryptionService,
      );

      const keys = await asymmetricEncryptionService.generateNewKeys();
      newCredentials = {
        token: 'valid_token',
        mnemonic: mnemonicEncryptedWithPassword,
        password: cryptoService.encryptText(decryptedPasswordHash),
        salt: cryptoService.encryptText(decryptedSalt),
        asymmetricEncryptedMnemonic: {
          ecc: await asymmetricEncryptionService.hybridEncryptMessageWithPublicKey(
            {
              message: plainMnemonic,
              publicKeyInBase64: keys.publicKeyArmored,
            },
          ),
          hybrid:
            await asymmetricEncryptionService.hybridEncryptMessageWithPublicKey(
              {
                message: plainMnemonic,
                publicKeyInBase64: keys.publicKeyArmored,
                publicKyberKeyBase64: keys.publicKyberKeyBase64,
              },
            ),
        },
        keys: {
          ecc: {
            private: keys.privateKeyArmored,
            public: keys.publicKeyArmored,
            revocationKey: keys.revocationCertificate,
          },
          kyber: {
            private: keys.privateKyberKeyBase64,
            public: keys.publicKyberKeyBase64,
          },
        },
      };
    });

    it('When user is not found, then it should throw NotFoundException', async () => {
      const userUuid = v4();

      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(null);

      await expect(
        userUseCases.recoverAccountLegacy(userUuid, newCredentials),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user is found, then it should update user with decrypted credentials', async () => {
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(user);
      jest.spyOn(userRepository, 'updateByUuid').mockResolvedValue(undefined);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsersOfOwnedWorkspaces')
        .mockResolvedValue([]);
      await userUseCases.recoverAccountLegacy(user.uuid, newCredentials);

      expect(userRepository.updateByUuid).toHaveBeenCalledWith(user.uuid, {
        mnemonic: mnemonicEncryptedWithPassword,
        password: decryptedPasswordHash,
        hKey: decryptedSalt,
      });
    });

    it('When credentials contain keys, then it should update each key by version', async () => {
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(user);
      jest.spyOn(userRepository, 'updateByUuid').mockResolvedValue(undefined);
      jest
        .spyOn(keyServerUseCases, 'updateByUserAndEncryptVersion')
        .mockResolvedValue(undefined);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsersOfOwnedWorkspaces')
        .mockResolvedValue([]);

      await userUseCases.recoverAccountLegacy(user.uuid, newCredentials);

      expect(
        keyServerUseCases.updateByUserAndEncryptVersion,
      ).toHaveBeenCalledWith(user.id, UserKeysEncryptVersions.Ecc, {
        privateKey: newCredentials.keys.ecc.private,
        publicKey: newCredentials.keys.ecc.public,
        revocationKey: newCredentials.keys.ecc.revocationKey,
      });
      expect(
        keyServerUseCases.updateByUserAndEncryptVersion,
      ).toHaveBeenCalledWith(user.id, UserKeysEncryptVersions.Kyber, {
        privateKey: newCredentials.keys.kyber.private,
        publicKey: newCredentials.keys.kyber.public,
      });
    });

    it('When user has owned workspaces, then it should update all workspace user encrypted keys', async () => {
      const workspaceAndUsers = [
        {
          workspace: newWorkspace(),
          workspaceUser: newWorkspaceUser({ memberId: user.uuid }),
        },
        {
          workspace: newWorkspace(),
          workspaceUser: newWorkspaceUser({ memberId: user.uuid }),
        },
      ];

      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(user);
      jest.spyOn(userRepository, 'updateByUuid').mockResolvedValue(undefined);
      jest
        .spyOn(workspaceRepository, 'findWorkspaceUsersOfOwnedWorkspaces')
        .mockResolvedValue(workspaceAndUsers);
      jest
        .spyOn(workspaceRepository, 'updateWorkspaceUserEncryptedKeyByMemberId')
        .mockResolvedValue(undefined);

      await userUseCases.recoverAccountLegacy(user.uuid, newCredentials);

      expect(
        workspaceRepository.updateWorkspaceUserEncryptedKeyByMemberId,
      ).toHaveBeenCalledTimes(2);
      expect(
        workspaceRepository.updateWorkspaceUserEncryptedKeyByMemberId,
      ).toHaveBeenCalledWith(
        workspaceAndUsers[0].workspaceUser.memberId,
        workspaceAndUsers[0].workspace.id,
        newCredentials.asymmetricEncryptedMnemonic.ecc,
      );
      expect(
        workspaceRepository.updateWorkspaceUserEncryptedKeyByMemberId,
      ).toHaveBeenCalledWith(
        workspaceAndUsers[1].workspaceUser.memberId,
        workspaceAndUsers[1].workspace.id,
        newCredentials.asymmetricEncryptedMnemonic.ecc,
      );
    });
  });

  describe('findByEmail', () => {
    it('When finding user by email, then it should call the repository with expected values', async () => {
      const email = 'test@example.com';
      const expectedUser = newUser({ attributes: { email } });
      jest
        .spyOn(userRepository, 'findByUsername')
        .mockResolvedValue(expectedUser);

      const result = await userUseCases.findByEmail(email);

      expect(userRepository.findByUsername).toHaveBeenCalledWith(email);
      expect(result).toEqual(expectedUser);
    });
  });

  describe('findPreCreatedByEmail', () => {
    it('When finding pre-created user by email, then it should call the repository with expected values', async () => {
      const email = 'test@example.com';
      const expectedUser = newPreCreatedUser();
      expectedUser.email = email;
      jest
        .spyOn(preCreatedUsersRepository, 'findByUsername')
        .mockResolvedValue(expectedUser);

      const result = await userUseCases.findPreCreatedByEmail(email);

      expect(preCreatedUsersRepository.findByUsername).toHaveBeenCalledWith(
        email,
      );
      expect(result).toEqual(expectedUser);
    });
  });

  describe('findByUuids', () => {
    it('When finding users by UUIDs, then it should call the repository with uuids', async () => {
      const uuids = [v4(), v4()];
      const expectedUsers = [newUser(), newUser()];
      jest
        .spyOn(userRepository, 'findByUuids')
        .mockResolvedValue(expectedUsers);

      const result = await userUseCases.findByUuids(uuids);

      expect(userRepository.findByUuids).toHaveBeenCalledWith(uuids);
      expect(result).toEqual(expectedUsers);
    });
  });

  describe('findPreCreatedUsersByUuids', () => {
    it('When finding pre-created users by UUIDs, then it should call the repository with UUIDs', async () => {
      const uuids = [v4(), v4()];
      const expectedUsers = [newPreCreatedUser(), newPreCreatedUser()];
      jest
        .spyOn(preCreatedUsersRepository, 'findByUuids')
        .mockResolvedValue(expectedUsers);

      const result = await userUseCases.findPreCreatedUsersByUuids(uuids);

      expect(preCreatedUsersRepository.findByUuids).toHaveBeenCalledWith(uuids);
      expect(result).toEqual(expectedUsers);
    });
  });

  describe('findByUuid', () => {
    it('When finding user by UUID, then it should call the repository with UUIDs', async () => {
      const uuid = v4();
      const expectedUser = newUser();
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(expectedUser);

      const result = await userUseCases.findByUuid(uuid);

      expect(userRepository.findByUuid).toHaveBeenCalledWith(uuid);
      expect(result).toEqual(expectedUser);
    });
  });

  describe('findById', () => {
    it('When finding user by ID, then it should call the repository with ID', async () => {
      const id = 123;
      const expectedUser = newUser();
      jest.spyOn(userRepository, 'findById').mockResolvedValue(expectedUser);

      const result = await userUseCases.findById(id);

      expect(userRepository.findById).toHaveBeenCalledWith(id);
      expect(result).toEqual(expectedUser);
    });
  });

  describe('getUserByUsername', () => {
    it('When getting user by username, then it should call the repository with email', async () => {
      const email = 'test@example.com';
      const expectedUser = newUser();
      jest
        .spyOn(userRepository, 'findByUsername')
        .mockResolvedValue(expectedUser);

      const result = await userUseCases.getUserByUsername(email);

      expect(userRepository.findByUsername).toHaveBeenCalledWith(email);
      expect(result).toEqual(expectedUser);
    });
  });

  describe('getWorkspaceMembersByBrigeUser', () => {
    it('When getting workspace members by bridge user, then it should call the repository with the respective bridge user', async () => {
      const bridgeUser = 'bridge-user';
      const expectedUsers = [newUser(), newUser()];
      jest.spyOn(userRepository, 'findAllBy').mockResolvedValue(expectedUsers);

      const result =
        await userUseCases.getWorkspaceMembersByBrigeUser(bridgeUser);

      expect(userRepository.findAllBy).toHaveBeenCalledWith({ bridgeUser });
      expect(result).toEqual(expectedUsers);
    });
  });

  describe('getUser', () => {
    it('When user exists, then it should return the user', async () => {
      const uuid = v4();
      const expectedUser = newUser();
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(expectedUser);

      const result = await userUseCases.getUser(uuid);

      expect(userRepository.findByUuid).toHaveBeenCalledWith(uuid);
      expect(result).toEqual(expectedUser);
    });

    it('When user does not exist, then it should throw error', async () => {
      const uuid = v4();
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(null);

      await expect(userUseCases.getUser(uuid)).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('sendWelcomeVerifyEmailEmail', () => {
    it('When sending welcome verify email, then it should call mail service with correct parameters', async () => {
      const email = 'test@example.com';
      const userUuid = v4();
      const secret = 'jwt-secret';
      const verificationToken = 'encrypted-token';
      const templateId = 'welcome-template-id';

      jest.spyOn(configService, 'get').mockImplementation((key) => {
        if (key === 'secrets.jwt') return secret;
        if (key === 'mailer.templates.welcomeVerifyEmail') return templateId;
        return undefined;
      });
      jest.spyOn(cryptoService, 'encrypt').mockReturnValue(verificationToken);
      jest.spyOn(mailerService, 'send').mockResolvedValue(undefined);

      const hostDriveWeb = 'https://drive.example.com';
      process.env.HOST_DRIVE_WEB = hostDriveWeb;

      const result = await userUseCases.sendWelcomeVerifyEmailEmail(email, {
        userUuid,
      });

      expect(cryptoService.encrypt).toHaveBeenCalledWith(
        userUuid,
        Buffer.from(secret),
      );
      expect(mailerService.send).toHaveBeenCalledWith(email, templateId, {
        verification_url: `${hostDriveWeb}/verify-email/${encodeURIComponent(verificationToken)}`,
        email_support: 'mailto:hello@internxt.com',
      });
      expect(result).toBeUndefined();
    });
  });

  describe('sendAccountRecoveryEmail', () => {
    it('When sending account recovery email, then it should call mail service with correct parameters', async () => {
      const email = 'test@example.com';
      const user = newUser({ attributes: { email } });
      const secret = 'jwt-secret';
      const templateId = 'recovery-template-id';
      const hostDriveWeb = 'https://drive.example.com';

      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(user);
      jest.spyOn(configService, 'get').mockImplementation((key) => {
        if (key === 'secrets.jwt') return secret;
        if (key === 'mailer.templates.recoverAccountEmail') return templateId;
        return undefined;
      });
      jest.spyOn(mailerService, 'send').mockResolvedValue(undefined);

      process.env.HOST_DRIVE_WEB = hostDriveWeb;

      const result = await userUseCases.sendAccountRecoveryEmail(email);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(email);
      expect(SignWithCustomDuration).toHaveBeenCalledWith(
        {
          payload: {
            uuid: user.uuid,
            action: 'recover-account',
          },
        },
        secret,
        '30m',
      );
      expect(mailerService.send).toHaveBeenCalledWith(user.email, templateId, {
        email,
        recovery_url: `${hostDriveWeb}/recover-account/anyToken`,
      });
      expect(result).toBeUndefined();
    });

    it('When user is not found, then it should throw NotFoundException', async () => {
      const email = 'nonexistent@example.com';
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);

      await expect(
        userUseCases.sendAccountRecoveryEmail(email),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAvatarUrl', () => {
    it('When avatar key is provided, then it should return the avatar URL', async () => {
      const avatarKey = 'avatar-key-123';
      const expectedUrl = 'https://example.com/avatar.jpg';
      jest
        .spyOn(avatarService, 'getDownloadUrl')
        .mockResolvedValue(expectedUrl);

      const result = await userUseCases.getAvatarUrl(avatarKey);

      expect(avatarService.getDownloadUrl).toHaveBeenCalledWith(avatarKey);
      expect(result).toEqual(expectedUrl);
    });

    it('When avatar key is not provided, then it should return null', async () => {
      const result = await userUseCases.getAvatarUrl(null);

      expect(avatarService.getDownloadUrl).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('When avatar key is empty string, then it should return null', async () => {
      const result = await userUseCases.getAvatarUrl('');

      expect(avatarService.getDownloadUrl).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('createAttemptChangeEmail', () => {
    it('When creating attempt change email, then it should create attempt and send email', async () => {
      const user = newUser();
      const newEmail = 'newemail@example.com';
      const attempt = { id: 123 };
      const encryptedId = 'encrypted-id';

      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(null);
      jest
        .spyOn(attemptChangeEmailRepository, 'create')
        .mockResolvedValue(attempt as any);
      jest.spyOn(cryptoService, 'encryptText').mockReturnValue(encryptedId);
      jest
        .spyOn(mailerService, 'sendUpdateUserEmailVerification')
        .mockResolvedValue(undefined);

      await userUseCases.createAttemptChangeEmail(user, newEmail);

      expect(userRepository.findByUsername).toHaveBeenCalledWith(newEmail);
      expect(attemptChangeEmailRepository.create).toHaveBeenCalledWith({
        userUuid: user.uuid,
        newEmail,
      });
      expect(cryptoService.encryptText).toHaveBeenCalledWith('123');
      expect(
        mailerService.sendUpdateUserEmailVerification,
      ).toHaveBeenCalledWith(newEmail, encryptedId);
    });

    it('When new email already exists, then it should throw', async () => {
      const user = newUser();
      const newEmail = 'existing@example.com';
      const existingUser = newUser({ attributes: { email: newEmail } });

      jest
        .spyOn(userRepository, 'findByUsername')
        .mockResolvedValue(existingUser);

      await expect(
        userUseCases.createAttemptChangeEmail(user, newEmail),
      ).rejects.toThrow(ConflictException);
    });

    it('When new email is the same as current email, then it should throw', async () => {
      const user = newUser({ attributes: { email: 'same@example.com' } });
      const newEmail = 'same@example.com';

      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(null);

      await expect(
        userUseCases.createAttemptChangeEmail(user, newEmail),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('isAttemptChangeEmailExpired', () => {
    it('When attempt exists and is not expired, then it should return isExpired false', async () => {
      const encryptedId = 'encrypted-id';
      const attemptId = '123';
      const attempt = createMock<AttemptChangeEmailModel>({
        isVerified: false,
        isExpired: false,
      });

      jest.spyOn(cryptoService, 'decryptText').mockReturnValue(attemptId);
      jest
        .spyOn(attemptChangeEmailRepository, 'getOneById')
        .mockResolvedValue(attempt);

      const result =
        await userUseCases.isAttemptChangeEmailExpired(encryptedId);

      expect(cryptoService.decryptText).toHaveBeenCalledWith(encryptedId);
      expect(attemptChangeEmailRepository.getOneById).toHaveBeenCalledWith(123);
      expect(result).toEqual({ isExpired: false });
    });

    it('When attempt exists and is expired, then it should return isExpired true', async () => {
      const encryptedId = 'encrypted-id';
      const attemptId = '123';
      const attempt = createMock<AttemptChangeEmailModel>({
        isVerified: false,
        isExpired: true,
      });

      jest.spyOn(cryptoService, 'decryptText').mockReturnValue(attemptId);
      jest
        .spyOn(attemptChangeEmailRepository, 'getOneById')
        .mockResolvedValue(attempt);

      const result =
        await userUseCases.isAttemptChangeEmailExpired(encryptedId);

      expect(result).toEqual({ isExpired: true });
    });

    it('When attempt does not exist, then it should throw', async () => {
      const encryptedId = 'encrypted-id';
      const attemptId = '123';

      jest.spyOn(cryptoService, 'decryptText').mockReturnValue(attemptId);
      jest
        .spyOn(attemptChangeEmailRepository, 'getOneById')
        .mockResolvedValue(null);

      await expect(
        userUseCases.isAttemptChangeEmailExpired(encryptedId),
      ).rejects.toThrow(AttemptChangeEmailNotFoundException);
    });

    it('When attempt is already verified, then it should throw', async () => {
      const encryptedId = 'encrypted-id';
      const attemptId = '123';
      const attempt = createMock<AttemptChangeEmailModel>({
        isVerified: true,
        isExpired: false,
      });

      jest.spyOn(cryptoService, 'decryptText').mockReturnValue(attemptId);
      jest
        .spyOn(attemptChangeEmailRepository, 'getOneById')
        .mockResolvedValue(attempt);

      await expect(
        userUseCases.isAttemptChangeEmailExpired(encryptedId),
      ).rejects.toThrow(AttemptChangeEmailAlreadyVerifiedException);
    });
  });

  describe('generateMnemonic', () => {
    it('When generating mnemonic, then it should return a 256-bit mnemonic', async () => {
      const result = await userUseCases.generateMnemonic();

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // 256-bit mnemonic should have 24 words
      expect(result.split(' ')).toHaveLength(24);
    });
  });

  describe('updateCredentials', () => {
    const mockUser = newUser();
    const mockCredentials = {
      mnemonic: 'encrypted_mnemonic',
      password: 'encrypted_password',
      salt: 'encrypted_salt',
      privateKeys: {
        ecc: 'encrypted_ecc_key',
        kyber: 'encrypted_kyber_key',
      },
    };

    const decryptedPassword = 'decrypted_password';
    const decryptedSalt = 'decrypted_salt';

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(cryptoService, 'decryptText').mockImplementation((text) => {
        if (text === mockCredentials.password) return decryptedPassword;
        if (text === mockCredentials.salt) return decryptedSalt;
        return text;
      });
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(mockUser);
      jest.spyOn(userRepository, 'updateByUuid').mockResolvedValue(undefined);
      jest.spyOn(userUseCases, 'resetUser').mockResolvedValue(undefined);
    });

    it('When updating credentials without reset and private keys, then it should update user and keys', async () => {
      await userUseCases.updateCredentials(mockUser.uuid, mockCredentials);

      expect(userRepository.updateByUuid).toHaveBeenCalledWith(mockUser.uuid, {
        mnemonic: mockCredentials.mnemonic,
        password: decryptedPassword,
        hKey: decryptedSalt,
      });

      expect(
        keyServerUseCases.updateByUserAndEncryptVersion,
      ).toHaveBeenCalledWith(mockUser.id, UserKeysEncryptVersions.Ecc, {
        privateKey: mockCredentials.privateKeys.ecc,
      });

      expect(
        keyServerUseCases.updateByUserAndEncryptVersion,
      ).toHaveBeenCalledWith(mockUser.id, UserKeysEncryptVersions.Kyber, {
        privateKey: mockCredentials.privateKeys.kyber,
      });

      expect(userUseCases.resetUser).not.toHaveBeenCalled();
    });

    it('When updating credentials with reset, then it should reset user data', async () => {
      await userUseCases.updateCredentials(
        mockUser.uuid,
        mockCredentials,
        true,
      );

      expect(userRepository.updateByUuid).toHaveBeenCalledWith(mockUser.uuid, {
        mnemonic: mockCredentials.mnemonic,
        password: decryptedPassword,
        hKey: decryptedSalt,
      });

      expect(userUseCases.resetUser).toHaveBeenCalledWith(mockUser, {
        deleteFiles: true,
        deleteFolders: true,
        deleteShares: true,
        deleteWorkspaces: true,
        deleteBackups: true,
      });
    });

    it('When updating credentials without reset but privateKeys are missing, then it should throw', async () => {
      const credentialsWithoutKeys = {
        ...mockCredentials,
        privateKeys: null,
      };

      await expect(
        userUseCases.updateCredentials(
          mockUser.uuid,
          credentialsWithoutKeys,
          false,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getNewTokenPayload', () => {
    it('When getting new token payload, then it should return formatted payload', () => {
      const userData = {
        uuid: v4(),
        email: 'test@example.com',
        name: 'Test',
        lastname: 'User',
        username: 'testuser',
        bridgeUser: 'bridge-user',
      };

      const result = userUseCases.getNewTokenPayload(userData);

      expect(result).toEqual({
        payload: {
          uuid: userData.uuid,
          email: userData.email,
          name: userData.name,
          lastname: userData.lastname,
          username: userData.username,
          sharedWorkspace: true,
          networkCredentials: {
            user: userData.bridgeUser,
          },
        },
        iat: getTokenDefaultIat(),
      });
    });
  });

  describe('createInitialFolders', () => {
    it('When creating initial folders, then it should create root, family and personal folders', async () => {
      const user = newUser();
      const bucketId = 'bucket-123';
      const rootFolder = newFolder({ attributes: { name: 'Root' } });
      const familyFolder = newFolder({ attributes: { name: 'Family' } });
      const personalFolder = newFolder({ attributes: { name: 'Personal' } });

      jest
        .spyOn(folderUseCases, 'createRootFolder')
        .mockResolvedValue(rootFolder);
      jest.spyOn(userRepository, 'updateById').mockResolvedValue(undefined);
      jest
        .spyOn(folderUseCases, 'createFolders')
        .mockResolvedValue([familyFolder, personalFolder]);

      const result = await userUseCases.createInitialFolders(user, bucketId);

      expect(folderUseCases.createRootFolder).toHaveBeenCalledWith(
        user,
        expect.any(String),
        bucketId,
      );
      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, {
        rootFolderId: rootFolder.id,
      });
      expect(folderUseCases.createFolders).toHaveBeenCalledWith(user, [
        {
          name: 'Family',
          parentFolderId: rootFolder.id,
          parentUuid: rootFolder.uuid,
        },
        {
          name: 'Personal',
          parentFolderId: rootFolder.id,
          parentUuid: rootFolder.uuid,
        },
      ]);
      expect(result).toEqual([rootFolder, familyFolder, personalFolder]);
    });
  });

  describe('preCreateUser', () => {
    it('When creating a pre-created user that does not exist, then it should create and return user data', async () => {
      const newUserDto: PreCreateUserDto = {
        email: 'test@example.com',
      };
      const defaultPass = 'default-password';
      const hashObj = { hash: 'hashed-password', salt: 'salt' };
      const encMnemonic = 'encrypted-mnemonic';
      const encPrivateKey = 'encrypted-private-key';
      const encKyberPrivateKey = 'encrypted-kyber-private-key';
      const keys = {
        privateKeyArmored: 'private-key-armored',
        publicKeyArmored: 'public-key-armored',
        revocationCertificate: 'revocation-cert',
        privateKyberKeyBase64: 'private-kyber-key',
        publicKyberKeyBase64: 'public-kyber-key',
      };
      const createdUser = newPreCreatedUser();
      createdUser.email = newUserDto.email;

      jest.spyOn(aes, 'encrypt').mockImplementation((data) => {
        if (data === keys.privateKeyArmored) return encPrivateKey;
        if (data === keys.privateKyberKeyBase64) return encKyberPrivateKey;
        return 'encrypted-' + data;
      });

      jest.spyOn(bip39, 'generateMnemonic').mockReturnValue(TEST_MNEMONIC);

      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(null);
      jest
        .spyOn(preCreatedUsersRepository, 'findByUsername')
        .mockResolvedValueOnce(null);
      jest.spyOn(configService, 'get').mockImplementation((key) => {
        if (key === 'users.preCreatedPassword') return defaultPass;
        return undefined;
      });
      jest.spyOn(cryptoService, 'passToHash').mockReturnValueOnce(hashObj);
      jest
        .spyOn(cryptoService, 'encryptTextWithKey')
        .mockReturnValueOnce(encMnemonic);
      jest
        .spyOn(asymmetricEncryptionService, 'generateNewKeys')
        .mockResolvedValue(keys);
      jest
        .spyOn(preCreatedUsersRepository, 'create')
        .mockResolvedValueOnce(createdUser);

      const [result, isPreCreated] =
        await userUseCases.preCreateUser(newUserDto);

      expect(userRepository.findByUsername).toHaveBeenCalledWith(
        newUserDto.email,
      );
      expect(preCreatedUsersRepository.findByUsername).toHaveBeenCalledWith(
        newUserDto.email,
      );
      expect(cryptoService.passToHash).toHaveBeenCalledWith(defaultPass);
      expect(cryptoService.encryptTextWithKey).toHaveBeenCalledWith(
        TEST_MNEMONIC,
        defaultPass,
      );
      expect(asymmetricEncryptionService.generateNewKeys).toHaveBeenCalled();
      expect(preCreatedUsersRepository.create).toHaveBeenCalled();
      expect(result).toEqual({
        ...createdUser.toJSON(),
        publicKyberKey: createdUser.publicKyberKey.toString(),
        publicKey: createdUser.publicKey.toString(),
        password: createdUser.password.toString(),
      });
      expect(isPreCreated).toBe(true);
    });

    it('When creating a pre-created user that already exists as regular user, then it should throw ConflictException', async () => {
      const newUserDto: PreCreateUserDto = {
        email: 'existing@example.com',
      };
      const existingUser = newUser({ attributes: { email: newUserDto.email } });

      jest
        .spyOn(userRepository, 'findByUsername')
        .mockResolvedValue(existingUser);

      await expect(userUseCases.preCreateUser(newUserDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('When creating a pre-created user that already exists as pre-created user, then it should return existing user', async () => {
      const newUserDto: PreCreateUserDto = {
        email: 'existing-precreated@example.com',
      };
      const existingPreCreatedUser = newPreCreatedUser();
      existingPreCreatedUser.email = newUserDto.email;

      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(null);
      jest
        .spyOn(preCreatedUsersRepository, 'findByUsername')
        .mockResolvedValue(existingPreCreatedUser);

      const [result, isPreCreated] =
        await userUseCases.preCreateUser(newUserDto);

      expect(result).toEqual({
        ...existingPreCreatedUser.toJSON(),
        publicKyberKey: existingPreCreatedUser.publicKyberKey.toString(),
        publicKey: existingPreCreatedUser.publicKey.toString(),
        password: existingPreCreatedUser.password.toString(),
      });
      expect(isPreCreated).toBe(false);
    });
  });

  describe('hasUploadedFiles', () => {
    const user = newUser();

    it('When user has uploaded files, then it should return true', async () => {
      jest.spyOn(fileUseCases, 'hasUploadedFiles').mockResolvedValue(true);

      const result = await userUseCases.hasUploadedFiles(user);

      expect(result).toBe(true);
      expect(fileUseCases.hasUploadedFiles).toHaveBeenCalledWith(user);
    });

    it('When user has not uploaded files, then it should return false', async () => {
      jest.spyOn(fileUseCases, 'hasUploadedFiles').mockResolvedValue(false);

      const result = await userUseCases.hasUploadedFiles(user);

      expect(result).toBe(false);
      expect(fileUseCases.hasUploadedFiles).toHaveBeenCalledWith(user);
    });

    it('When fileUseCases throws an error, then it should propagate the error', async () => {
      const errorMessage = 'Database connection failed';
      jest
        .spyOn(fileUseCases, 'hasUploadedFiles')
        .mockRejectedValue(new Error(errorMessage));

      await expect(userUseCases.hasUploadedFiles(user)).rejects.toThrow(
        errorMessage,
      );
      expect(fileUseCases.hasUploadedFiles).toHaveBeenCalledWith(user);
    });
  });

  describe('getOrPreCreateUser', () => {
    const testEmail = 'test@example.com';
    const requestingUser = newUser();

    it('When user exists, then it should return existing public keys', async () => {
      const existingUser = newUser({ attributes: { email: testEmail } });
      const mockKeys = {
        ecc: 'existing-ecc-key',
        kyber: 'existing-kyber-key',
      };

      jest
        .spyOn(userUseCases, 'getUserByUsername')
        .mockResolvedValue(existingUser);
      jest
        .spyOn(keyServerUseCases, 'getPublicKeys')
        .mockResolvedValue(mockKeys);

      const result = await userUseCases.getOrPreCreateUser(
        testEmail,
        requestingUser,
      );

      expect(userUseCases.getUserByUsername).toHaveBeenCalledWith(testEmail);
      expect(keyServerUseCases.getPublicKeys).toHaveBeenCalledWith(
        existingUser.id,
      );
      expect(result).toEqual({
        publicKey: mockKeys.ecc,
        publicKyberKey: mockKeys.kyber,
      });
    });

    it('When user exists but has no keys, then it should return null keys', async () => {
      const existingUser = newUser({ attributes: { email: testEmail } });
      const mockKeys = {
        ecc: null,
        kyber: null,
      };

      jest
        .spyOn(userUseCases, 'getUserByUsername')
        .mockResolvedValue(existingUser);
      jest
        .spyOn(keyServerUseCases, 'getPublicKeys')
        .mockResolvedValue(mockKeys);

      const result = await userUseCases.getOrPreCreateUser(
        testEmail,
        requestingUser,
      );

      expect(userUseCases.getUserByUsername).toHaveBeenCalledWith(testEmail);
      expect(keyServerUseCases.getPublicKeys).toHaveBeenCalledWith(
        existingUser.id,
      );
      expect(result).toEqual({
        publicKey: null,
        publicKyberKey: null,
      });
    });

    it('When user does not exist and limit not reached, then it should pre-create user and return new keys', async () => {
      const preCreatedUser = newPreCreatedUser();
      const mockLimit = newMailLimit({
        attemptsCount: 5,
        attemptsLimit: 50,
      });

      jest.spyOn(userUseCases, 'getUserByUsername').mockResolvedValue(null);
      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mockLimit, false]);
      jest.spyOn(userUseCases, 'preCreateUser').mockResolvedValue([
        {
          ...preCreatedUser.toJSON(),
          publicKey: preCreatedUser.publicKey.toString(),
          publicKyberKey: preCreatedUser.publicKyberKey.toString(),
          password: preCreatedUser.password.toString(),
        },
        true,
      ]);
      jest.spyOn(mockLimit, 'increaseTodayAttempts');
      jest.spyOn(mailLimitRepository, 'updateByUserIdAndMailType');

      const result = await userUseCases.getOrPreCreateUser(
        testEmail,
        requestingUser,
      );

      expect(userUseCases.getUserByUsername).toHaveBeenCalledWith(testEmail);
      expect(mailLimitRepository.findOrCreate).toHaveBeenCalledWith(
        {
          userId: requestingUser.id,
          mailType: MailTypes.PreCreateUser,
        },
        {
          userId: requestingUser.id,
          mailType: MailTypes.PreCreateUser,
          attemptsLimit: 50,
          attemptsCount: 0,
          lastMailSent: expect.any(Date),
        },
      );
      expect(userUseCases.preCreateUser).toHaveBeenCalledWith({
        email: testEmail,
      });
      expect(mockLimit.increaseTodayAttempts).toHaveBeenCalled();
      expect(
        mailLimitRepository.updateByUserIdAndMailType,
      ).toHaveBeenCalledWith(
        requestingUser.id,
        MailTypes.PreCreateUser,
        mockLimit,
      );
      expect(result).toEqual({
        publicKey: preCreatedUser.publicKey,
        publicKyberKey: preCreatedUser.publicKyberKey,
      });
    });

    it('When user does not exist but daily limit is reached, then it should throw MailLimitReachedException', async () => {
      const mockLimit = newMailLimit({
        attemptsCount: 50,
        attemptsLimit: 50,
      });

      jest.spyOn(userUseCases, 'getUserByUsername').mockResolvedValue(null);
      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mockLimit, false]);
      jest.spyOn(mockLimit, 'isLimitForTodayReached').mockReturnValue(true);
      jest.spyOn(userUseCases, 'preCreateUser');

      await expect(
        userUseCases.getOrPreCreateUser(testEmail, requestingUser),
      ).rejects.toThrow(MailLimitReachedException);

      expect(userUseCases.getUserByUsername).toHaveBeenCalledWith(testEmail);
      expect(mailLimitRepository.findOrCreate).toHaveBeenCalledWith(
        {
          userId: requestingUser.id,
          mailType: MailTypes.PreCreateUser,
        },
        {
          userId: requestingUser.id,
          mailType: MailTypes.PreCreateUser,
          attemptsLimit: 50,
          attemptsCount: 0,
          lastMailSent: expect.any(Date),
        },
      );
      expect(userUseCases.preCreateUser).not.toHaveBeenCalled();
    });

    it('When user does not exist and pre-creation fails, then it should throw the error', async () => {
      const error = new Error('Pre-creation failed');
      const mockLimit = newMailLimit({
        attemptsCount: 5,
        attemptsLimit: 50,
      });

      jest.spyOn(userUseCases, 'getUserByUsername').mockResolvedValue(null);
      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mockLimit, false]);
      jest.spyOn(userUseCases, 'preCreateUser').mockRejectedValue(error);

      await expect(
        userUseCases.getOrPreCreateUser(testEmail, requestingUser),
      ).rejects.toThrow(error);

      expect(userUseCases.getUserByUsername).toHaveBeenCalledWith(testEmail);
      expect(userUseCases.preCreateUser).toHaveBeenCalledWith({
        email: testEmail,
      });
    });

    it('When getting existing user keys fails, then it should throw the error', async () => {
      const existingUser = newUser({ attributes: { email: testEmail } });
      const error = new Error('Key retrieval failed');

      jest
        .spyOn(userUseCases, 'getUserByUsername')
        .mockResolvedValue(existingUser);
      jest.spyOn(keyServerUseCases, 'getPublicKeys').mockRejectedValue(error);

      await expect(
        userUseCases.getOrPreCreateUser(testEmail, requestingUser),
      ).rejects.toThrow(error);

      expect(userUseCases.getUserByUsername).toHaveBeenCalledWith(testEmail);
      expect(keyServerUseCases.getPublicKeys).toHaveBeenCalledWith(
        existingUser.id,
      );
    });
  });

  describe('getCachedAvatar', () => {
    it('When user has no avatar, then returns null without hitting cache', async () => {
      const userNoAvatar = newUser();
      userNoAvatar.avatar = null as string;

      const result = await userUseCases.getCachedAvatar(userNoAvatar as User);

      expect(result).toBeNull();
      expect(cacheManagerService.getUserAvatar).not.toHaveBeenCalled();
      expect(avatarService.getDownloadUrl).not.toHaveBeenCalled();
    });

    it('When cache hit, then returns cached url and does not fetch', async () => {
      const u = newUser();
      u.avatar = 'avatar-key' as string;
      const cachedUrl = 'https://cdn.example.com/avatar.jpg';

      jest
        .spyOn(cacheManagerService, 'getUserAvatar')
        .mockResolvedValueOnce(cachedUrl);

      const result = await userUseCases.getCachedAvatar(u as User);

      expect(result).toBe(cachedUrl);
      expect(cacheManagerService.getUserAvatar).toHaveBeenCalledWith(u.uuid);
      expect(avatarService.getDownloadUrl).not.toHaveBeenCalled();
      expect(cacheManagerService.setUserAvatar).not.toHaveBeenCalled();
    });

    it('When cache miss, then fetches url, caches it, and returns it', async () => {
      const u = newUser();
      u.avatar = 'avatar-key' as string;
      const fetchedUrl = 'https://cdn.example.com/avatar.png';

      jest
        .spyOn(cacheManagerService, 'getUserAvatar')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(avatarService, 'getDownloadUrl')
        .mockResolvedValueOnce(fetchedUrl);

      const result = await userUseCases.getCachedAvatar(u as User);

      expect(result).toBe(fetchedUrl);
      expect(cacheManagerService.getUserAvatar).toHaveBeenCalledWith(u.uuid);
      expect(avatarService.getDownloadUrl).toHaveBeenCalledWith(u.avatar);
      expect(cacheManagerService.setUserAvatar).toHaveBeenCalledWith(
        u.uuid,
        fetchedUrl,
      );
    });

    it('When cache miss and avatar service returns null, then returns null and does not cache', async () => {
      const u = newUser();
      u.avatar = 'avatar-key' as string;

      jest
        .spyOn(cacheManagerService, 'getUserAvatar')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(avatarService, 'getDownloadUrl')
        .mockResolvedValueOnce(null as any);

      const result = await userUseCases.getCachedAvatar(u as User);

      expect(result).toBeNull();
      expect(cacheManagerService.setUserAvatar).not.toHaveBeenCalled();
    });
  });

  describe('handleIncompleteCheckoutEvent', () => {
    const mockUser = newUser({ attributes: { email: 'test@internxt.com' } });
    const mockIncompleteCheckoutDto: IncompleteCheckoutDto = {
      completeCheckoutUrl: 'https://drive.internxt.com/checkout/complete',
    };

    it('When valid user and dto are provided and limit not reached, then should send email successfully', async () => {
      const mockMailLimit = newMailLimit({
        userId: mockUser.id,
        attemptsCount: 1,
        attemptsLimit: 5,
      });
      jest
        .spyOn(mockMailLimit, 'isLimitForTodayReached')
        .mockReturnValue(false);
      jest.spyOn(mockMailLimit, 'increaseTodayAttempts');

      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mockMailLimit, true]);
      jest
        .spyOn(mailLimitRepository, 'updateByUserIdAndMailType')
        .mockResolvedValue(undefined);
      jest
        .spyOn(mailerService, 'sendIncompleteCheckoutEmail')
        .mockResolvedValue(undefined);

      const result = await userUseCases.handleIncompleteCheckoutEvent(
        mockUser,
        mockIncompleteCheckoutDto,
      );

      expect(result).toEqual({ success: true });
      expect(mailLimitRepository.findOrCreate).toHaveBeenCalledWith(
        {
          userId: mockUser.id,
          mailType: MailTypes.IncompleteCheckout,
        },
        {
          attemptsCount: 0,
          attemptsLimit: 5,
          lastMailSent: expect.any(Date),
          userId: mockUser.id,
          mailType: MailTypes.IncompleteCheckout,
        },
      );
      expect(mockMailLimit.isLimitForTodayReached).toHaveBeenCalled();
      expect(mailerService.sendIncompleteCheckoutEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockIncompleteCheckoutDto.completeCheckoutUrl,
      );
      expect(mockMailLimit.increaseTodayAttempts).toHaveBeenCalled();
      expect(
        mailLimitRepository.updateByUserIdAndMailType,
      ).toHaveBeenCalledWith(
        mockUser.id,
        MailTypes.IncompleteCheckout,
        mockMailLimit,
      );
    });

    it('When limit for today is reached, then should throw BadRequestException', async () => {
      const mockMailLimit = newMailLimit({
        userId: mockUser.id,
        attemptsCount: 5,
        attemptsLimit: 5,
      });
      jest.spyOn(mockMailLimit, 'isLimitForTodayReached').mockReturnValue(true);
      jest.spyOn(mockMailLimit, 'increaseTodayAttempts');

      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mockMailLimit, false]);

      await expect(
        userUseCases.handleIncompleteCheckoutEvent(
          mockUser,
          mockIncompleteCheckoutDto,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockMailLimit.isLimitForTodayReached).toHaveBeenCalled();
      expect(mailerService.sendIncompleteCheckoutEmail).not.toHaveBeenCalled();
      expect(mockMailLimit.increaseTodayAttempts).not.toHaveBeenCalled();
    });

    it('When mailer service throws error, then should propagate the error', async () => {
      const mockMailLimit = newMailLimit({
        userId: mockUser.id,
        attemptsCount: 1,
        attemptsLimit: 5,
      });
      jest
        .spyOn(mockMailLimit, 'isLimitForTodayReached')
        .mockReturnValue(false);
      jest.spyOn(mockMailLimit, 'increaseTodayAttempts');
      const mockError = new Error('SendGrid service unavailable');

      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mockMailLimit, true]);
      jest
        .spyOn(mailerService, 'sendIncompleteCheckoutEmail')
        .mockRejectedValue(mockError);

      await expect(
        userUseCases.handleIncompleteCheckoutEvent(
          mockUser,
          mockIncompleteCheckoutDto,
        ),
      ).rejects.toThrow(mockError);

      expect(mockMailLimit.isLimitForTodayReached).toHaveBeenCalled();
      expect(mailerService.sendIncompleteCheckoutEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockIncompleteCheckoutDto.completeCheckoutUrl,
      );
      expect(mockMailLimit.increaseTodayAttempts).not.toHaveBeenCalled();
    });
  });

  describe('checkAndNotifyStorageThreshold', () => {
    const mockUser = newUser({ attributes: { email: 'test@internxt.com' } });
    const NOTIFY_THRESHOLD = 80;
    const MAX_EMAILS_PER_MONTH = 2;

    it('When usage is below threshold, then should not send email', async () => {
      const limit = 100 * 1024 * 1024 * 1024;
      const totalUsage = 75 * 1024 * 1024 * 1024;
      const usage = { drive: totalUsage, backup: 0, total: totalUsage };

      jest.spyOn(userUseCases, 'getSpaceLimit').mockResolvedValue(limit);

      await userUseCases.checkAndNotifyStorageThreshold(mockUser, usage);

      expect(mailLimitRepository.findOrCreate).not.toHaveBeenCalled();
      expect(mailerService.sendFullStorageEmail).not.toHaveBeenCalled();
    });

    it('When usage is at threshold and first notification, then should send email', async () => {
      const limit = 100 * 1024 * 1024 * 1024;
      const totalUsage = 85 * 1024 * 1024 * 1024;
      const usage = { drive: totalUsage, backup: 0, total: totalUsage };
      const lastMailSent = new Date();
      lastMailSent.setDate(lastMailSent.getDate() - 20);

      const mockMailLimit = newMailLimit({
        userId: mockUser.id,
        mailType: MailTypes.FullStorage,
        attemptsCount: 0,
        attemptsLimit: MAX_EMAILS_PER_MONTH,
        lastMailSent,
      });

      jest
        .spyOn(mockMailLimit, 'isLimitForThisMonthReached')
        .mockReturnValue(false);
      jest.spyOn(mockMailLimit, 'increaseMonthAttempts');

      jest.spyOn(userUseCases, 'getSpaceLimit').mockResolvedValue(limit);
      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mockMailLimit, true]);
      jest
        .spyOn(mailLimitRepository, 'updateByUserIdAndMailType')
        .mockResolvedValue(undefined);
      jest
        .spyOn(mailerService, 'sendFullStorageEmail')
        .mockResolvedValue(undefined);

      await userUseCases.checkAndNotifyStorageThreshold(mockUser, usage);

      expect(mailerService.sendFullStorageEmail).toHaveBeenCalledWith(
        mockUser.email,
      );
      expect(mockMailLimit.increaseMonthAttempts).toHaveBeenCalled();
      expect(
        mailLimitRepository.updateByUserIdAndMailType,
      ).toHaveBeenCalledWith(mockUser.id, MailTypes.FullStorage, mockMailLimit);
    });

    it('When user reaches storage threshold for first time, then should send notification immediately without cooldown', async () => {
      const limit = 100 * 1024 * 1024 * 1024;
      const totalUsage = 85 * 1024 * 1024 * 1024;
      const usage = { drive: totalUsage, backup: 0, total: totalUsage };

      const mockMailLimit = newMailLimit({
        userId: mockUser.id,
        mailType: MailTypes.FullStorage,
        attemptsCount: 0,
        attemptsLimit: MAX_EMAILS_PER_MONTH,
        lastMailSent: new Date(0),
      });

      jest
        .spyOn(mockMailLimit, 'isLimitForThisMonthReached')
        .mockReturnValue(false);
      jest.spyOn(mockMailLimit, 'increaseMonthAttempts');

      jest.spyOn(userUseCases, 'getSpaceLimit').mockResolvedValue(limit);

      const findOrCreateSpy = jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mockMailLimit, true]);

      jest
        .spyOn(mailLimitRepository, 'updateByUserIdAndMailType')
        .mockResolvedValue(undefined);
      jest
        .spyOn(mailerService, 'sendFullStorageEmail')
        .mockResolvedValue(undefined);

      await userUseCases.checkAndNotifyStorageThreshold(mockUser, usage);

      expect(findOrCreateSpy).toHaveBeenCalledWith(
        {
          userId: mockUser.id,
          mailType: MailTypes.FullStorage,
        },
        {
          attemptsCount: 0,
          attemptsLimit: MAX_EMAILS_PER_MONTH,
          lastMailSent: expect.any(Date),
        },
      );

      const callArgs = findOrCreateSpy.mock.calls[0][1];
      expect(callArgs.lastMailSent.getTime()).toBe(0);

      expect(mailerService.sendFullStorageEmail).toHaveBeenCalledWith(
        mockUser.email,
      );
    });

    it('When cooldown is active, then should not send email', async () => {
      const limit = 100 * 1024 * 1024 * 1024;
      const totalUsage = 85 * 1024 * 1024 * 1024;
      const usage = { drive: totalUsage, backup: 0, total: totalUsage };
      const lastMailSent = new Date();
      lastMailSent.setDate(lastMailSent.getDate() - 5);

      const mockMailLimit = newMailLimit({
        userId: mockUser.id,
        mailType: MailTypes.FullStorage,
        attemptsCount: 1,
        attemptsLimit: MAX_EMAILS_PER_MONTH,
        lastMailSent,
      });

      jest.spyOn(userUseCases, 'getSpaceLimit').mockResolvedValue(limit);
      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mockMailLimit, false]);

      await userUseCases.checkAndNotifyStorageThreshold(mockUser, usage);

      expect(mailerService.sendFullStorageEmail).not.toHaveBeenCalled();
    });

    it('When cooldown is exactly 14 days, then should send email', async () => {
      const limit = 100 * 1024 * 1024 * 1024;
      const totalUsage = 85 * 1024 * 1024 * 1024;
      const usage = { drive: totalUsage, backup: 0, total: totalUsage };
      const lastMailSent = new Date();
      lastMailSent.setDate(lastMailSent.getDate() - 14);

      const mockMailLimit = newMailLimit({
        userId: mockUser.id,
        mailType: MailTypes.FullStorage,
        attemptsCount: 1,
        attemptsLimit: MAX_EMAILS_PER_MONTH,
        lastMailSent,
      });

      jest
        .spyOn(mockMailLimit, 'isLimitForThisMonthReached')
        .mockReturnValue(false);
      jest.spyOn(mockMailLimit, 'increaseMonthAttempts');

      jest.spyOn(userUseCases, 'getSpaceLimit').mockResolvedValue(limit);
      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mockMailLimit, false]);
      jest
        .spyOn(mailLimitRepository, 'updateByUserIdAndMailType')
        .mockResolvedValue(undefined);
      jest
        .spyOn(mailerService, 'sendFullStorageEmail')
        .mockResolvedValue(undefined);

      await userUseCases.checkAndNotifyStorageThreshold(mockUser, usage);

      expect(mailerService.sendFullStorageEmail).toHaveBeenCalledWith(
        mockUser.email,
      );
      expect(mockMailLimit.increaseMonthAttempts).toHaveBeenCalled();
    });

    it('When cooldown is over 14 days, then should send email', async () => {
      const limit = 100 * 1024 * 1024 * 1024;
      const totalUsage = 85 * 1024 * 1024 * 1024;
      const usage = { drive: totalUsage, backup: 0, total: totalUsage };
      const lastMailSent = new Date();
      lastMailSent.setDate(lastMailSent.getDate() - 20);

      const mockMailLimit = newMailLimit({
        userId: mockUser.id,
        mailType: MailTypes.FullStorage,
        attemptsCount: 1,
        attemptsLimit: MAX_EMAILS_PER_MONTH,
        lastMailSent,
      });

      jest
        .spyOn(mockMailLimit, 'isLimitForThisMonthReached')
        .mockReturnValue(false);
      jest.spyOn(mockMailLimit, 'increaseMonthAttempts');

      jest.spyOn(userUseCases, 'getSpaceLimit').mockResolvedValue(limit);
      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mockMailLimit, false]);
      jest
        .spyOn(mailLimitRepository, 'updateByUserIdAndMailType')
        .mockResolvedValue(undefined);
      jest
        .spyOn(mailerService, 'sendFullStorageEmail')
        .mockResolvedValue(undefined);

      await userUseCases.checkAndNotifyStorageThreshold(mockUser, usage);

      expect(mailerService.sendFullStorageEmail).toHaveBeenCalledWith(
        mockUser.email,
      );
      expect(mockMailLimit.increaseMonthAttempts).toHaveBeenCalled();
    });

    it('When monthly limit is reached, then should not send email', async () => {
      const limit = 100 * 1024 * 1024 * 1024;
      const totalUsage = 85 * 1024 * 1024 * 1024;
      const usage = { drive: totalUsage, backup: 0, total: totalUsage };
      const lastMailSent = new Date();
      lastMailSent.setDate(lastMailSent.getDate() - 14);

      const mockMailLimit = newMailLimit({
        userId: mockUser.id,
        mailType: MailTypes.FullStorage,
        attemptsCount: 2,
        attemptsLimit: MAX_EMAILS_PER_MONTH,
        lastMailSent,
      });

      jest
        .spyOn(mockMailLimit, 'isLimitForThisMonthReached')
        .mockReturnValue(true);

      jest.spyOn(userUseCases, 'getSpaceLimit').mockResolvedValue(limit);
      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mockMailLimit, false]);

      await userUseCases.checkAndNotifyStorageThreshold(mockUser, usage);

      expect(mailerService.sendFullStorageEmail).not.toHaveBeenCalled();
    });

    it('When new month starts with previous attempts, then should reset counter and send email', async () => {
      const limit = 100 * 1024 * 1024 * 1024;
      const totalUsage = 85 * 1024 * 1024 * 1024;
      const usage = { drive: totalUsage, backup: 0, total: totalUsage };
      const lastMailSent = new Date();
      lastMailSent.setMonth(lastMailSent.getMonth() - 1);

      const mockMailLimit = newMailLimit({
        userId: mockUser.id,
        mailType: MailTypes.FullStorage,
        attemptsCount: 2,
        attemptsLimit: MAX_EMAILS_PER_MONTH,
        lastMailSent,
      });

      jest
        .spyOn(mockMailLimit, 'isLimitForThisMonthReached')
        .mockReturnValue(false);
      jest.spyOn(mockMailLimit, 'increaseMonthAttempts');

      jest.spyOn(userUseCases, 'getSpaceLimit').mockResolvedValue(limit);
      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mockMailLimit, false]);
      jest
        .spyOn(mailLimitRepository, 'updateByUserIdAndMailType')
        .mockResolvedValue(undefined);
      jest
        .spyOn(mailerService, 'sendFullStorageEmail')
        .mockResolvedValue(undefined);

      await userUseCases.checkAndNotifyStorageThreshold(mockUser, usage);

      expect(mailerService.sendFullStorageEmail).toHaveBeenCalledWith(
        mockUser.email,
      );
      expect(mockMailLimit.increaseMonthAttempts).toHaveBeenCalled();
    });

    it('When second email of month is allowed, then should send email', async () => {
      const limit = 100 * 1024 * 1024 * 1024;
      const totalUsage = 85 * 1024 * 1024 * 1024;
      const usage = { drive: totalUsage, backup: 0, total: totalUsage };
      const lastMailSent = new Date();
      lastMailSent.setDate(lastMailSent.getDate() - 14);

      const mockMailLimit = newMailLimit({
        userId: mockUser.id,
        mailType: MailTypes.FullStorage,
        attemptsCount: 1,
        attemptsLimit: MAX_EMAILS_PER_MONTH,
        lastMailSent,
      });

      jest
        .spyOn(mockMailLimit, 'isLimitForThisMonthReached')
        .mockReturnValue(false);
      jest.spyOn(mockMailLimit, 'increaseMonthAttempts');

      jest.spyOn(userUseCases, 'getSpaceLimit').mockResolvedValue(limit);
      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mockMailLimit, false]);
      jest
        .spyOn(mailLimitRepository, 'updateByUserIdAndMailType')
        .mockResolvedValue(undefined);
      jest
        .spyOn(mailerService, 'sendFullStorageEmail')
        .mockResolvedValue(undefined);

      await userUseCases.checkAndNotifyStorageThreshold(mockUser, usage);

      expect(mailerService.sendFullStorageEmail).toHaveBeenCalledWith(
        mockUser.email,
      );
      expect(mockMailLimit.increaseMonthAttempts).toHaveBeenCalled();
    });

    it('When mailer service throws error, then should not increment counter', async () => {
      const limit = 100 * 1024 * 1024 * 1024;
      const totalUsage = 85 * 1024 * 1024 * 1024;
      const usage = { drive: totalUsage, backup: 0, total: totalUsage };
      const lastMailSent = new Date();
      lastMailSent.setDate(lastMailSent.getDate() - 14);
      const mockError = new Error('SendGrid service unavailable');

      const mockMailLimit = newMailLimit({
        userId: mockUser.id,
        mailType: MailTypes.FullStorage,
        attemptsCount: 1,
        attemptsLimit: MAX_EMAILS_PER_MONTH,
        lastMailSent,
      });

      jest
        .spyOn(mockMailLimit, 'isLimitForThisMonthReached')
        .mockReturnValue(false);
      jest.spyOn(mockMailLimit, 'increaseMonthAttempts');

      jest.spyOn(userUseCases, 'getSpaceLimit').mockResolvedValue(limit);
      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mockMailLimit, false]);
      jest
        .spyOn(mailerService, 'sendFullStorageEmail')
        .mockRejectedValue(mockError);

      await userUseCases.checkAndNotifyStorageThreshold(mockUser, usage);

      expect(mailerService.sendFullStorageEmail).toHaveBeenCalledWith(
        mockUser.email,
      );
      expect(mockMailLimit.increaseMonthAttempts).not.toHaveBeenCalled();
      expect(
        mailLimitRepository.updateByUserIdAndMailType,
      ).not.toHaveBeenCalled();
    });

    it('When new month with day 1, then should reset counter automatically', async () => {
      const limit = 100 * 1024 * 1024 * 1024;
      const totalUsage = 85 * 1024 * 1024 * 1024;
      const usage = { drive: totalUsage, backup: 0, total: totalUsage };
      const lastMailSent = new Date('2024-10-01T00:00:00Z');

      const mockMailLimit = newMailLimit({
        userId: mockUser.id,
        mailType: MailTypes.FullStorage,
        attemptsCount: 2,
        attemptsLimit: MAX_EMAILS_PER_MONTH,
        lastMailSent,
      });

      jest.spyOn(mockMailLimit, 'increaseMonthAttempts');

      jest.spyOn(userUseCases, 'getSpaceLimit').mockResolvedValue(limit);
      jest
        .spyOn(mailLimitRepository, 'findOrCreate')
        .mockResolvedValue([mockMailLimit, false]);
      jest
        .spyOn(mailLimitRepository, 'updateByUserIdAndMailType')
        .mockResolvedValue(undefined);
      jest
        .spyOn(mailerService, 'sendFullStorageEmail')
        .mockResolvedValue(undefined);

      await userUseCases.checkAndNotifyStorageThreshold(mockUser, usage);

      expect(mailerService.sendFullStorageEmail).toHaveBeenCalledWith(
        mockUser.email,
      );
      expect(mockMailLimit.increaseMonthAttempts).toHaveBeenCalled();
    });

    describe('getUserCredentials', () => {
      it('When called with custom tokenExpirationTime, then it should return all properties', async () => {
        const testUser = newUser();
        const folder = newFolder({ attributes: { bucket: 'user-bucket' } });
        const keys = {
          ecc: {
            privateKey: 'ecc-priv',
            publicKey: 'ecc-pub',
            revocationKey: 'ecc-rev',
          },
          kyber: {
            privateKey: 'kyber-priv',
            publicKey: 'kyber-pub',
          },
        } as { kyber: KeyServer; ecc: KeyServer };
        const authTokens = { token: 'old-token', newToken: 'new-token' };

        const expectedCredentials = {
          oldToken: authTokens.token,
          token: authTokens.token,
          newToken: authTokens.newToken,
          user: expect.objectContaining({
            email: testUser.email,
            uuid: testUser.uuid,
            bucket: folder.bucket,
            root_folder_id: folder.id,
            rootFolderId: folder.uuid,
            privateKey: keys.ecc.privateKey,
            publicKey: keys.ecc.publicKey,
            revocateKey: keys.ecc.revocationKey,
            keys: {
              ecc: {
                privateKey: keys.ecc.privateKey,
                publicKey: keys.ecc.publicKey,
              },
              kyber: {
                privateKey: keys.kyber.privateKey,
                publicKey: keys.kyber.publicKey,
              },
            },
            avatar: 'https://cdn.example.com/avatar.png',
          }),
        };

        jest
          .spyOn(userUseCases, 'getAuthTokens')
          .mockResolvedValueOnce(authTokens as any);
        jest
          .spyOn(userUseCases, 'getAvatarUrl')
          .mockResolvedValueOnce('https://cdn.example.com/avatar.png' as any);
        jest
          .spyOn(userUseCases, 'getOrCreateUserRootFolderAndBucket')
          .mockResolvedValueOnce(folder);
        jest
          .spyOn(keyServerUseCases, 'findUserKeys')
          .mockResolvedValueOnce(keys);

        const result = await userUseCases.getUserCredentials(testUser, '7d');

        expect(userUseCases.getAuthTokens).toHaveBeenCalledWith(
          testUser,
          undefined,
          '7d',
        );
        expect(userUseCases.getAvatarUrl).toHaveBeenCalledWith(testUser.avatar);
        expect(
          userUseCases.getOrCreateUserRootFolderAndBucket,
        ).toHaveBeenCalledWith(testUser);
        expect(keyServerUseCases.findUserKeys).toHaveBeenCalledWith(
          testUser.id,
        );

        expect(result).toMatchObject(expectedCredentials);
      });

      it('When avatar is missing, then avatar in response should be null', async () => {
        const testUser = newUser({ attributes: { avatar: null } });
        const folder = newFolder({ attributes: { bucket: 'bucket-x' } });
        const keys = { ecc: null, kyber: null } as {
          kyber: KeyServer;
          ecc: KeyServer;
        };

        jest
          .spyOn(userUseCases, 'getAuthTokens')
          .mockResolvedValueOnce({ token: 't', newToken: 'nt' });
        jest.spyOn(userUseCases, 'getAvatarUrl').mockResolvedValueOnce(null);
        jest
          .spyOn(userUseCases, 'getOrCreateUserRootFolderAndBucket')
          .mockResolvedValueOnce(folder);
        jest
          .spyOn(keyServerUseCases, 'findUserKeys')
          .mockResolvedValueOnce(keys);

        const result = await userUseCases.getUserCredentials(testUser);

        expect(result.user.avatar).toBeNull();
        expect(result.user.keys).toEqual({
          ecc: { privateKey: null, publicKey: null },
          kyber: { privateKey: null, publicKey: null },
        });
      });

      it('When key server returns null keys, then keys fields should be null in user response', async () => {
        const testUser = newUser();
        const folder = newFolder({ attributes: { bucket: 'bucket-y' } });

        jest
          .spyOn(userUseCases, 'getAuthTokens')
          .mockResolvedValueOnce({ token: 't2', newToken: 'nt2' } as any);
        jest
          .spyOn(userUseCases, 'getAvatarUrl')
          .mockResolvedValueOnce(null as any);
        jest
          .spyOn(userUseCases, 'getOrCreateUserRootFolderAndBucket')
          .mockResolvedValueOnce(folder as any);
        jest
          .spyOn(keyServerUseCases, 'findUserKeys')
          .mockResolvedValueOnce({ ecc: null, kyber: null } as any);

        const result = await userUseCases.getUserCredentials(testUser);

        expect(result.user.privateKey).toBeNull();
        expect(result.user.publicKey).toBeNull();
        expect(result.user.revocateKey).toBeNull();
        expect(result.user.keys).toEqual({
          ecc: { privateKey: null, publicKey: null },
          kyber: { privateKey: null, publicKey: null },
        });
      });
    });
  });
});
