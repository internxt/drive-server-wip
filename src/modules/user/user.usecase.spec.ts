import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { aes } from '@internxt/lib';

import { AttemptChangeEmailModel } from './attempt-change-email.model';
import { UserEmailAlreadyInUseException } from './exception/user-email-already-in-use.exception';

import {
  MailLimitReachedException,
  UserUseCases,
  ReferralsNotAvailableError,
} from './user.usecase';
import { ShareUseCases } from '../share/share.usecase';
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
  UnauthorizedException,
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
  newPreCreatedUser,
  newWorkspace,
  newWorkspaceUser,
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
import { UserKeysEncryptVersions } from '../keyserver/key-server.domain';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { SequelizeSharingRepository } from '../sharing/sharing.repository';
import { SequelizePreCreatedUsersRepository } from './pre-created-users.repository';
import { AsymmetricEncryptionService } from '../../externals/asymmetric-encryption/asymmetric-encryption.service';
import { SharingInvite } from '../sharing/sharing.domain';
import { AppSumoUseCase } from '../app-sumo/app-sumo.usecase';
import { BackupUseCase } from '../backups/backup.usecase';

jest.mock('../../middlewares/passport', () => {
  const originalModule = jest.requireActual('../../middlewares/passport');
  return {
    __esModule: true,
    ...originalModule,
    SignWithCustomDuration: jest.fn((payload, secret, expiresIn) => 'anyToken'),
    Sign: jest.fn(() => 'newToken'),
    SignEmail: jest.fn(() => 'token'),
  };
});

describe('User use cases', () => {
  let userUseCases: UserUseCases;
  let shareUseCases: ShareUseCases;
  let folderUseCases: FolderUseCases;
  let fileUseCases: FileUseCases;
  let userRepository: SequelizeUserRepository;
  let keyServerRepository: SequelizeKeyServerRepository;
  let bridgeService: BridgeService;
  let sharedWorkspaceRepository: SequelizeSharedWorkspaceRepository;
  let sharingRepository: SequelizeSharingRepository;
  let preCreatedUsersRepository: SequelizePreCreatedUsersRepository;
  let asymmetricEncryptionService: AsymmetricEncryptionService;

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

  const loggerErrorSpy = jest.spyOn(Logger, 'error').mockImplementation();

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
    uuid: 'uuid',
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
    const moduleRef = await createTestingModule();

    shareUseCases = moduleRef.get<ShareUseCases>(ShareUseCases);
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

    appSumoUseCases = moduleRef.get<AppSumoUseCase>(AppSumoUseCase);
    backupUseCases = moduleRef.get<BackupUseCase>(BackupUseCase);
    jest.clearAllMocks();
  });

  describe('Resetting a user', () => {
    it('When all options are false, then the reset does nothing', async () => {
      const deleteSharesSpy = jest.spyOn(shareUseCases, 'deleteByUser');
      const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
      const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');

      await userUseCases.resetUser(user, {
        deleteFiles: false,
        deleteFolders: false,
        deleteShares: false,
      });

      expect(deleteSharesSpy).not.toBeCalled();
      expect(deleteFoldersSpy).not.toBeCalled();
      expect(deleteFilesSpy).not.toBeCalled();
    });

    describe('When options are provided', () => {
      it('When delete shares is true, then the shares are deleted', async () => {
        const deleteSharesSpy = jest.spyOn(shareUseCases, 'deleteByUser');
        const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
        const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');

        await userUseCases.resetUser(user, {
          deleteFiles: false,
          deleteFolders: false,
          deleteShares: true,
        });

        expect(deleteSharesSpy).toBeCalledWith(user);
        expect(deleteFoldersSpy).not.toBeCalled();
        expect(deleteFilesSpy).not.toBeCalled();
      });

      describe('When resources do not exist', () => {
        it('When delete folders is true, then the folders are deleted', async () => {
          const deleteSharesSpy = jest.spyOn(shareUseCases, 'deleteByUser');
          const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
          const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');
          const getFoldersSpy = jest.spyOn(folderUseCases, 'getFolders');
          const folders = [];
          getFoldersSpy.mockReturnValue(Promise.resolve(folders));

          await userUseCases.resetUser(user, {
            deleteFiles: false,
            deleteFolders: true,
            deleteShares: false,
          });

          expect(getFoldersSpy).toBeCalledWith(
            user.id,
            { parentId: user.rootFolderId, removed: false },
            {
              limit: 50,
              offset: 0,
            },
          );
          expect(deleteSharesSpy).not.toBeCalled();
          expect(deleteFoldersSpy).toBeCalledWith(user, folders);
          expect(deleteFilesSpy).not.toBeCalled();
        });

        it('When delete files is true, then the files are deleted', async () => {
          const deleteSharesSpy = jest.spyOn(shareUseCases, 'deleteByUser');
          const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
          const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');
          const getFilesSpy = jest.spyOn(fileUseCases, 'getFilesNotDeleted');
          const files = [];
          getFilesSpy.mockReturnValue(Promise.resolve(files));

          await userUseCases.resetUser(user, {
            deleteFiles: true,
            deleteFolders: false,
            deleteShares: false,
          });

          expect(getFilesSpy).toBeCalledWith(
            user.id,
            { folderId: user.rootFolderId },
            {
              limit: 50,
              offset: 0,
            },
          );
          expect(deleteSharesSpy).not.toBeCalled();
          expect(deleteFoldersSpy).not.toBeCalled();
          expect(deleteFilesSpy).toBeCalledWith(user, files);
        });
      });

      describe('When resources exist', () => {
        it('When delete folders is true, then the folders are deleted', async () => {
          const deleteSharesSpy = jest.spyOn(shareUseCases, 'deleteByUser');
          const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
          const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');
          const getFoldersSpy = jest.spyOn(folderUseCases, 'getFolders');
          const folders = [Folder.build({} as FolderAttributes)];
          getFoldersSpy.mockReturnValue(Promise.resolve(folders));

          await userUseCases.resetUser(user, {
            deleteFiles: false,
            deleteFolders: true,
            deleteShares: false,
          });

          expect(getFoldersSpy).toBeCalledWith(
            user.id,
            { parentId: user.rootFolderId, removed: false },
            {
              limit: 50,
              offset: 0,
            },
          );
          expect(deleteSharesSpy).not.toBeCalled();
          expect(deleteFoldersSpy).toBeCalledWith(user, folders);
          expect(deleteFilesSpy).not.toBeCalled();
        });

        it('When delete files is true, then the files are deleted', async () => {
          const deleteSharesSpy = jest.spyOn(shareUseCases, 'deleteByUser');
          const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
          const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');
          const getFilesSpy = jest.spyOn(fileUseCases, 'getFilesNotDeleted');
          const files = [newFile(), newFile()];
          getFilesSpy.mockReturnValue(Promise.resolve(files));

          await userUseCases.resetUser(user, {
            deleteFiles: true,
            deleteFolders: false,
            deleteShares: false,
          });

          expect(getFilesSpy).toBeCalledWith(
            user.id,
            { folderId: user.rootFolderId },
            {
              limit: 50,
              offset: 0,
            },
          );
          expect(deleteSharesSpy).not.toBeCalled();
          expect(deleteFoldersSpy).not.toBeCalled();
          expect(deleteFilesSpy).toBeCalledWith(user, files);
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

  describe('replacePreCreatedUser', () => {
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

    it('When invite is hybrid and no Kyber keys are provided, then delete the invite', async () => {
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

      try {
        await userUseCases.changeUserEmailById(
          user.uuid,
          'newuseremail@inxt.com',
        );
      } catch (e) {
        expect(bridgeService.updateUserEmail).toHaveBeenCalledWith(
          user.uuid,
          user.email,
        );
      }
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
      ).rejects.toThrowError('Change email failed');
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
        true,
        customIat,
      );

      expect(Sign).toHaveBeenCalledWith(
        {
          payload: {
            uuid: user.uuid,
            email: user.email,
            name: user.name,
            lastname: user.lastname,
            username: user.username,
            sharedWorkspace: true,
            networkCredentials: {
              user: user.bridgeUser,
              pass: user.userId,
            },
            workspaces: {
              owners: [],
            },
          },
          iat: customIat,
        },
        jwtSecret,
        true,
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
        true,
        undefined,
      );

      expect(Sign).toHaveBeenCalledWith(
        {
          payload: {
            uuid: user.uuid,
            email: user.email,
            name: user.name,
            lastname: user.lastname,
            username: user.username,
            sharedWorkspace: true,
            networkCredentials: {
              user: user.bridgeUser,
              pass: user.userId,
            },
            workspaces: {
              owners: [workspace.ownerId],
            },
          },
        },
        jwtSecret,
        true,
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
        .spyOn(folderUseCases, 'getUserRootFolder')
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
        .spyOn(folderUseCases, 'getUserRootFolder')
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

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        '[STORAGE]: ERROR message undefined applying referral for user %s',
        userId,
      );
    });

    it('When a ReferralsNotAvailableError is logged, then it should not log anything', () => {
      const userId = v4();
      const error = new ReferralsNotAvailableError();

      userUseCases.logReferralError(userId, error);

      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    it('When another error is logged, then it should log error message for other errors', () => {
      const userId = v4();
      const errorMessage = 'Some error occurred';

      userUseCases.logReferralError(userId, new Error(errorMessage));

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        '[STORAGE]: ERROR applying referral for user %s: %s',
        userId,
        errorMessage,
      );
    });

    it('When a non-Error object is logged, Then it should log "Unknown error"', () => {
      const userId = v4();
      const error = 'This is a string error';

      userUseCases.logReferralError(userId, error);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
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
});

const createTestingModule = (): Promise<TestingModule> => {
  return Test.createTestingModule({
    controllers: [],
    providers: [UserUseCases],
  })
    .useMocker(() => createMock())
    .compile();
};
