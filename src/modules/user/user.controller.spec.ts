import { DeepMocked, createMock } from '@golevelup/ts-jest';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwtUtils from '../../lib/jwt';
import {
  newKeyServer,
  newPreCreatedUser,
  newUser,
} from '../../../test/fixtures';
import getEnv from '../../config/configuration';
import { UserController } from './user.controller';
import { MailLimitReachedException, UserUseCases } from './user.usecase';
import { NotificationService } from '../../externals/notifications/notification.service';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { SignWithCustomDuration } from '../../middlewares/passport';
import { AccountTokenAction, User } from './user.domain';
import { v4 } from 'uuid';
import { DeviceType } from './dto/register-notification-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserKeysEncryptVersions } from '../keyserver/key-server.domain';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { RegisterPreCreatedUserDto } from './dto/register-pre-created-user.dto';
import { Request } from 'express';
import { DeactivationRequestEvent } from '../../externals/notifications/events/deactivation-request.event';
import { Test } from '@nestjs/testing';
import {
  RecoverAccountDto,
  DeprecatedRecoverAccountDto,
} from './dto/recover-account.dto';
import { LegacyRecoverAccountDto } from './dto/legacy-recover-account.dto';
import { ClientEnum } from '../../common/enums/platform.enum';
import { IncompleteCheckoutDto } from './dto/incomplete-checkout.dto';
import { AuditLogService } from '../../common/audit-logs/audit-log.service';
import {
  AuditAction,
  AuditEntityType,
  AuditPerformerType,
} from '../../common/audit-logs/audit-logs.attributes';
import { KlaviyoTrackingService } from '../../externals/klaviyo/klaviyo-tracking.service';

jest.mock('../../config/configuration', () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      secrets: {
        jwt: 'Test',
        jitsiSecret: 'jitsi secret',
      },
      jitsi: {
        appId: 'jitsi-app-id',
        apiKey: 'jitsi-api-key',
      },
      avatar: {
        accessKey: 'accessKey',
        secretKey: 'secretKey',
        bucket: 'bucket',
        region: 'region',
        endpoint: 'http://localhost:9001',
        endpointForSignedUrls: 'http://localhost:9000',
        forcePathStyle: true,
      },
    })),
  };
});

jest.mock('../../lib/jwt', () => {
  return {
    ...jest.requireActual('../../lib/jitsi'),
    generateJitsiJWT: jest.fn(() => 'newJitsiJwt'),
    verifyWithDefaultSecret: jest.fn(() => 'defaultVerifiedSecret'),
    verifyToken: jest.fn(),
  };
});

describe('User Controller', () => {
  let userController: UserController;
  let userUseCases: DeepMocked<UserUseCases>;
  let notificationService: DeepMocked<NotificationService>;
  let keyServerUseCases: DeepMocked<KeyServerUseCases>;
  let cryptoService: DeepMocked<CryptoService>;
  let auditLogService: DeepMocked<AuditLogService>;
  let klaviyoService: KlaviyoTrackingService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();
    userController = moduleRef.get(UserController);
    userUseCases = moduleRef.get(UserUseCases);
    notificationService = moduleRef.get(NotificationService);
    keyServerUseCases = moduleRef.get(KeyServerUseCases);
    cryptoService = moduleRef.get(CryptoService);
    auditLogService = moduleRef.get(AuditLogService);
    klaviyoService = moduleRef.get(KlaviyoTrackingService);
  });

  it('should be defined', () => {
    expect(userController).toBeDefined();
  });

  describe('POST /unblock-account', () => {
    it('When an error is returned, then it should throw the error again to be catched by global exception filter', async () => {
      const error = new Error('Not http error');
      userUseCases.sendAccountUnblockEmail.mockRejectedValueOnce(error);
      await expect(
        userController.requestAccountUnblock({ email: '' }),
      ).rejects.toThrow(error);
    });

    it('When mail Limit is reached, then 429 error is shown', async () => {
      userUseCases.sendAccountUnblockEmail.mockRejectedValueOnce(
        new MailLimitReachedException(),
      );
      await expect(
        userController.requestAccountUnblock({ email: '' }),
      ).rejects.toThrow(MailLimitReachedException);
    });
  });

  describe('PUT /unblock-account', () => {
    const user = newUser();
    const validToken = SignWithCustomDuration(
      {
        payload: {
          uuid: user.uuid,
          email: user.email,
          action: AccountTokenAction.Unblock,
        },
      },
      getEnv().secrets.jwt,
      '48h',
    );
    it('When token has invalid signature, then fails', async () => {
      const invalidToken = SignWithCustomDuration(
        {
          payload: {},
        },
        'Invalid Signature',
        '48h',
      );
      await expect(userController.accountUnblock(invalidToken)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('When token has valid signature but incorrect properties, then fails', async () => {
      const invalidToken = SignWithCustomDuration(
        {
          payload: {
            uuid: 'invalid Uuid',
            email: 'test@test.com',
            action: 'not unlock action',
          },
        },
        getEnv().secrets.jwt,
        '48h',
      );
      await expect(userController.accountUnblock(invalidToken)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('When token is expired, then fails', async () => {
      const expiredToken = SignWithCustomDuration(
        {
          payload: {},
        },
        getEnv().secrets.jwt,
        '-48h',
      );
      await expect(userController.accountUnblock(expiredToken)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('When token and user are correct, then resolves', async () => {
      userUseCases.unblockAccount.mockResolvedValueOnce();

      jest.spyOn(jwtUtils, 'verifyWithDefaultSecret').mockReturnValueOnce({
        payload: {
          uuid: user.uuid,
          email: user.email,
          action: AccountTokenAction.Unblock,
        },
        iat: 123123,
      });

      await expect(
        userController.accountUnblock(validToken),
      ).resolves.toBeUndefined();
    });
  });

  describe('GET /meet token beta', () => {
    const user = newUser();
    it('When beta token is requested and user is in the closed beta, then it generates a meet token and a new room', async () => {
      userUseCases.getMeetClosedBetaUsers.mockResolvedValue([user.email]);

      const result = await userController.getMeetTokenBeta(user, null);
      expect(result.token).toBeDefined();
      expect(result.room).toBeDefined();
    });

    it('When beta token with a room is requested and user is in the closed beta, then it generates a meet token and returns that room', async () => {
      userUseCases.getMeetClosedBetaUsers.mockResolvedValue([user.email]);
      userUseCases.getBetaUserFromRoom.mockResolvedValue(user);

      const room = v4();
      const result = await userController.getMeetTokenBeta(user, room);
      expect(result.token).toBeDefined();
      expect(result.room).toBe(room);
    });

    it('When beta token is requested and user is not in the closed beta, then it throws an error', async () => {
      userUseCases.getMeetClosedBetaUsers.mockResolvedValue([]);

      await expect(userController.getMeetTokenBeta(user, null)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(userController.getMeetTokenBeta(user, v4())).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('GET /meet token anon', () => {
    const user = newUser();
    it('When anon token is requested and the room is created, then it generates a new anon meet token', async () => {
      userUseCases.getBetaUserFromRoom.mockResolvedValue(user);

      const result = await userController.getMeetTokenAnon(v4());
      expect(result.token).toBeDefined();
    });

    it('When anon token is requested and the room is not created, then it throws an error', async () => {
      userUseCases.getBetaUserFromRoom.mockResolvedValue(null);

      await expect(userController.getMeetTokenAnon(v4())).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('POST /notification-token', () => {
    const user = newUser();
    it('When notification token is added, then it adds the token', async () => {
      userUseCases.registerUserNotificationToken.mockResolvedValueOnce();
      await expect(
        userController.addNotificationToken(user, {
          token: 'test',
          type: DeviceType.macos,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('POST /email-verification', () => {
    it('When the verification token is valid, then email is verified', async () => {
      const verifyEmailDto = { verificationToken: 'valid-token' };
      userUseCases.verifyUserEmail.mockResolvedValueOnce(undefined);

      await expect(
        userController.verifyAccountEmail(verifyEmailDto),
      ).resolves.toBeUndefined();

      expect(userUseCases.verifyUserEmail).toHaveBeenCalledWith(
        verifyEmailDto.verificationToken,
      );
    });

    it('When the verification token is invalid, then it throws an error', async () => {
      const verifyEmailDto = { verificationToken: 'invalid-token' };
      userUseCases.verifyUserEmail.mockRejectedValueOnce(
        new BadRequestException(),
      );

      await expect(
        userController.verifyAccountEmail(verifyEmailDto),
      ).rejects.toThrow(BadRequestException);

      expect(userUseCases.verifyUserEmail).toHaveBeenCalledWith(
        verifyEmailDto.verificationToken,
      );
    });
  });

  describe('POST /email-verification/send', () => {
    it('When the user has not reached the mail limit, then it sends a verification email', async () => {
      const user = newUser();
      userUseCases.sendAccountEmailVerification.mockResolvedValueOnce(
        undefined,
      );

      await expect(
        userController.sendAccountVerifyEmail(user),
      ).resolves.toBeUndefined();

      expect(userUseCases.sendAccountEmailVerification).toHaveBeenCalledWith(
        user,
      );
    });
  });

  describe('PATCH /profile', () => {
    const user = newUser();
    it('When name is provided and valid, then it should call updateProfile with the correct parameters', async () => {
      const updateProfileDto: UpdateProfileDto = {
        name: 'Internxt',
      };

      await userController.updateProfile(user, updateProfileDto);

      expect(userUseCases.updateProfile).toHaveBeenCalledWith(
        user,
        updateProfileDto,
      );
    });

    it('When lastname is provided as an empty string, then it should call updateProfile with the correct parameters', async () => {
      const updateProfileDto: UpdateProfileDto = {
        lastname: '',
      };

      await userController.updateProfile(user, updateProfileDto);

      expect(userUseCases.updateProfile).toHaveBeenCalledWith(
        user,
        updateProfileDto,
      );
    });

    it('When both name and lastname are not provided, then it should throw', async () => {
      const updateProfileDto: UpdateProfileDto = {
        name: undefined,
        lastname: undefined,
      };

      await expect(
        userController.updateProfile(user, updateProfileDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('When name is null, then it should throw', async () => {
      const updateProfileDto: UpdateProfileDto = {
        name: null,
      };

      await expect(
        userController.updateProfile(user, updateProfileDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('When lastname is null, then it should throw', async () => {
      const updateProfileDto: UpdateProfileDto = {
        lastname: null,
      };

      await expect(
        userController.updateProfile(user, updateProfileDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('When both name and lastname are null, then it should throw', async () => {
      const updateProfileDto: UpdateProfileDto = {
        name: null,
        lastname: null,
      };

      await expect(
        userController.updateProfile(user, updateProfileDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /avatar/refresh', () => {
    const user = newUser();
    const avatarKey = 'some-avatar-key';
    const avatarURL = 'https://cdn.example.com/avatars/' + v4();

    beforeEach(() => {
      user.avatar = avatarKey;
    });

    test('when the user has an avatar, then it should return a cached link for the avatar', async () => {
      jest.spyOn(userUseCases, 'getCachedAvatar').mockResolvedValue(avatarURL);

      const result = await userController.refreshAvatarUser(user);

      expect(result).toStrictEqual({ avatar: avatarURL });
      expect(userUseCases.getCachedAvatar).toHaveBeenCalledWith(user);
    });

    test('When the user does not have avatar, then return null', async () => {
      user.avatar = null;
      jest.spyOn(userUseCases, 'getCachedAvatar').mockResolvedValue(null);

      const result = await userController.refreshAvatarUser(user);

      expect(result).toStrictEqual({ avatar: null });
      expect(userUseCases.getCachedAvatar).toHaveBeenCalledWith(user);
    });

    test('When the user has avatar but cache/miss returns null, then return null', async () => {
      user.avatar = avatarKey;
      jest.spyOn(userUseCases, 'getCachedAvatar').mockResolvedValue(null);

      const result = await userController.refreshAvatarUser(user);

      expect(result).toStrictEqual({ avatar: null });
      expect(userUseCases.getCachedAvatar).toHaveBeenCalledWith(user);
    });

    test('When getCachedAvatar throws, then it should propagate the error', async () => {
      const error = new Error('cache failure');
      jest.spyOn(userUseCases, 'getCachedAvatar').mockRejectedValue(error);

      await expect(userController.refreshAvatarUser(user)).rejects.toThrow(
        error,
      );
      expect(userUseCases.getCachedAvatar).toHaveBeenCalledWith(user);
    });
  });

  describe('PUT /avatar', () => {
    const user = newUser();
    const newAvatarKey = v4();
    const avatar: Express.Multer.File | any = {
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

    it('When uploadAvatar is called with a valid avatar then it should upload the avatar', async () => {
      avatar.key = newAvatarKey;
      const avatarURL = 'https://localhost:9000/avatars/' + v4();
      const mockResponse = { avatar: avatarURL };
      jest
        .spyOn(userUseCases, 'upsertAvatar')
        .mockResolvedValue({ avatar: avatarURL });
      const result = await userController.uploadAvatar(avatar, user);
      expect(result).toEqual(mockResponse);
      expect(userUseCases.upsertAvatar).toHaveBeenCalledWith(
        user,
        newAvatarKey,
      );
    });

    it('When uploadAvatar is called without an avatar then it should throw', async () => {
      const mockAvatar = undefined;
      await expect(
        userController.uploadAvatar(mockAvatar, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('When uploadAvatar is called without a key then it should throw', async () => {
      avatar.key = null;
      await expect(userController.uploadAvatar(avatar, user)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('When upsertAvatar throws an error, then it should log the error and rethrow it', async () => {
      avatar.key = newAvatarKey;
      const errorMessage = 'Failed to upload avatar';
      jest
        .spyOn(userUseCases, 'upsertAvatar')
        .mockRejectedValue(new Error(errorMessage));
      const loggerSpy = jest.spyOn(Logger, 'error').mockImplementation();

      await expect(userController.uploadAvatar(avatar, user)).rejects.toThrow(
        Error,
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        `[USER/UPLOAD_AVATAR] Error uploading avatar for user: ${user.id}. Error: ${errorMessage}`,
      );

      loggerSpy.mockRestore();
    });
  });

  describe('DELETE /avatar', () => {
    const user = newUser();
    it('When deleteAvatar is called then it should delete the user avatar', async () => {
      jest.spyOn(userUseCases, 'deleteAvatar').mockResolvedValue(undefined);

      await userController.deleteAvatar(user);
      expect(userUseCases.deleteAvatar).toHaveBeenCalledWith(user);
    });

    it('When deleteAvatar throws an error, then it should log the error and rethrow it', async () => {
      const errorMessage = 'Failed to delete avatar';
      jest
        .spyOn(userUseCases, 'deleteAvatar')
        .mockRejectedValue(new Error(errorMessage));
      const loggerSpy = jest.spyOn(Logger, 'error').mockImplementation();

      await expect(userController.deleteAvatar(user)).rejects.toThrow(Error);
      expect(loggerSpy).toHaveBeenCalledWith(
        `[USER/DELETE_AVATAR] Error deleting the avatar for the user: ${user.id} has failed. Error: ${errorMessage}`,
      );

      loggerSpy.mockRestore();
    });
  });

  describe('GET /public-key/:email', () => {
    const mockUser = newUser();

    it('When public keys are requested, then it should return the publicKey field for backward compatibility', async () => {
      const kyberKeys = newKeyServer({
        userId: mockUser.id,
        encryptVersion: UserKeysEncryptVersions.Kyber,
      });
      const eccKeys = newKeyServer({ userId: mockUser.id });

      keyServerUseCases.getPublicKeys.mockResolvedValueOnce({
        kyber: kyberKeys.publicKey,
        ecc: eccKeys.publicKey,
      });

      const response = await userController.getPublicKeyByEmail(mockUser.email);

      expect(response.publicKey).toEqual(eccKeys.publicKey);
    });

    it('When public keys are requested, then it should return the keys object containing public keys for each encryption method', async () => {
      const kyberKeys = newKeyServer({
        userId: mockUser.id,
        encryptVersion: UserKeysEncryptVersions.Kyber,
      });
      const eccKeys = newKeyServer({ userId: mockUser.id });

      keyServerUseCases.getPublicKeys.mockResolvedValueOnce({
        kyber: kyberKeys.publicKey,
        ecc: eccKeys.publicKey,
      });

      const response = await userController.getPublicKeyByEmail(mockUser.email);

      expect(response.keys).toMatchObject({
        kyber: kyberKeys.publicKey,
        ecc: eccKeys.publicKey,
      });
    });

    it('When public keys are requested and user does not have keys, then it should return empty keys object and public key', async () => {
      keyServerUseCases.getPublicKeys.mockResolvedValueOnce({
        kyber: null,
        ecc: null,
      });

      const response = await userController.getPublicKeyByEmail(mockUser.email);

      expect(response.keys).toMatchObject({
        kyber: null,
        ecc: null,
      });
      expect(response.publicKey).toEqual(null);
    });
  });

  describe('PATCH /password', () => {
    const mockUser = newUser();
    const clientId = ClientEnum.Web;
    const mockUpdatePasswordDto: UpdatePasswordDto = {
      currentPassword: 'encryptedCurrentPassword',
      newPassword: 'encryptedNewPassword',
      newSalt: 'encryptedNewSalt',
      mnemonic: 'mockMnemonic',
      privateKey: 'mockPrivateKey',
      encryptVersion: 'ecc',
      privateKyberKey: 'encryptedPrivateKyberKey',
    };

    it('When client is not drive-web, then it throws', async () => {
      const invalidClient = 'invalid-client';
      await expect(
        userController.updatePassword(
          mockUpdatePasswordDto,
          mockUser,
          invalidClient,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When current password does not match, then it throws', async () => {
      cryptoService.decryptText.mockReturnValueOnce('decryptedCurrentPassword');
      mockUser.password = 'differentPassword';

      await expect(
        userController.updatePassword(
          mockUpdatePasswordDto,
          mockUser,
          clientId,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('When all conditions are met, it updates the password and returns tokens', async () => {
      const newPassword = 'newPassword';
      const newSalt = 'newSalt';

      const kyberKey = newKeyServer({
        encryptVersion: UserKeysEncryptVersions.Kyber,
      });
      const eccKey = newKeyServer();

      const mockTokens = {
        token: 'mockToken',
        newToken: 'mockNewToken',
      };
      cryptoService.decryptText
        .mockReturnValueOnce(mockUser.password) // currentPassword
        .mockReturnValueOnce(newPassword)
        .mockReturnValueOnce(newSalt);
      keyServerUseCases.findUserKeys.mockResolvedValueOnce({
        kyber: kyberKey,
        ecc: eccKey,
      });
      userUseCases.getAuthTokens.mockResolvedValueOnce(mockTokens);

      const result = await userController.updatePassword(
        mockUpdatePasswordDto,
        mockUser,
        clientId,
      );

      expect(userUseCases.updatePassword).toHaveBeenCalledWith(mockUser, {
        currentPassword: mockUser.password,
        newPassword: newPassword,
        newSalt: newSalt,
        mnemonic: mockUpdatePasswordDto.mnemonic,
        privateKey: mockUpdatePasswordDto.privateKey,
        encryptVersion: mockUpdatePasswordDto.encryptVersion,
        privateKyberKey: mockUpdatePasswordDto.privateKyberKey,
      });
      expect(result).toEqual({ status: 'success', ...mockTokens });
    });
  });

  describe('POST /create-user', () => {
    const clientId = ClientEnum.Web;
    const req = createMock<Request>();

    const mockUser = newUser();
    const mockCreateUserResponse = {
      user: { ...mockUser, rootFolderUuid: 'string' } as unknown as User & {
        rootFolderUuid: string;
      },
      token: 'mock-token',
      newToken: 'new token',
      uuid: 'mock-uuid',
    };

    it('When the user is created with new keys object, then the user and keys should be created successfully', async () => {
      const newKyberKeys = newKeyServer({
        userId: mockUser.id,
        encryptVersion: UserKeysEncryptVersions.Kyber,
      });
      const newEccKeys = newKeyServer({ userId: mockUser.id });
      const newKeys = {
        kyber: {
          publicKey: newKyberKeys.publicKey,
          privateKey: newKyberKeys.privateKey,
        },
        ecc: {
          publicKey: newEccKeys.publicKey,
          privateKey: newEccKeys.privateKey,
          revocationKey: newEccKeys.revocationKey,
        },
      };
      const createUserDto: CreateUserDto = {
        name: 'My',
        lastname: 'Internxt',
        email: 'test@test.com',
        password: 'hashed password',
        mnemonic: 'mnemonic',
        salt: 'salt',
        privateKey: 'privateKey',
        publicKey: 'publicKey',
        revocationKey: 'revocationKey',
        keys: newKeys,
      };

      keyServerUseCases.parseKeysInput.mockReturnValueOnce(newKeys);
      userUseCases.createUser.mockResolvedValueOnce(mockCreateUserResponse);
      keyServerUseCases.addKeysToUser.mockResolvedValueOnce({
        kyber: newKyberKeys,
        ecc: newEccKeys,
      });

      const result = await userController.createUser(
        createUserDto,
        req,
        clientId,
      );

      expect(userUseCases.createUser).toHaveBeenCalledWith(createUserDto);
      expect(keyServerUseCases.addKeysToUser).toHaveBeenCalledWith(
        mockUser.id,
        {
          kyber: {
            publicKey: newKeys.kyber.publicKey,
            privateKey: newKeys.kyber.privateKey,
          },
          ecc: {
            publicKey: newKeys.ecc.publicKey,
            privateKey: newKeys.ecc.privateKey,
            revocationKey: newKeys.ecc.revocationKey,
          },
        },
      );
      expect((result as any).user).toMatchObject({
        publicKey: newKeys.ecc.publicKey,
        privateKey: newKeys.ecc.privateKey,
        revocationKey: newKeys.ecc.revocationKey,
        keys: newKeys,
      });
    });

    it('When the user is created and ecc keys are found, then it should try to replace pre created user invitations', async () => {
      const existentEccKey = newKeyServer({ userId: mockUser.id });

      const createUserDto: CreateUserDto = {
        name: 'My',
        lastname: 'Internxt',
        email: 'test@test.com',
        password: 'hashed password',
        mnemonic: 'mnemonic',
        salt: 'salt',
      };

      userUseCases.createUser.mockResolvedValueOnce(mockCreateUserResponse);
      keyServerUseCases.addKeysToUser.mockResolvedValueOnce({
        kyber: null,
        ecc: existentEccKey,
      });

      await userController.createUser(createUserDto, req, clientId);

      expect(userUseCases.replacePreCreatedUser).toHaveBeenCalled();
    });
  });

  describe('POST /pre-created-users/register', () => {
    const req = createMock<Request>({
      headers: { 'internxt-client': ClientEnum.Web } as any,
    });
    const preCreatedUser = newPreCreatedUser();
    const mockUser = newUser({ attributes: { email: preCreatedUser.email } });

    const mockCreateUserResponse = {
      user: { ...mockUser, rootFolderUuid: 'string' } as unknown as User & {
        rootFolderUuid: string;
      },
      token: 'mock-token',
      newToken: 'new token',
      uuid: v4(),
    };

    it('When the pre-created user is registered, then the user and keys should be created successfully', async () => {
      const newKyberKeys = newKeyServer({
        userId: mockUser.id,
        encryptVersion: UserKeysEncryptVersions.Kyber,
      });
      const newEccKeys = newKeyServer({ userId: mockUser.id });
      const newKeys = {
        kyber: {
          publicKey: newKyberKeys.publicKey,
          privateKey: newKyberKeys.privateKey,
        },
        ecc: {
          publicKey: newEccKeys.publicKey,
          privateKey: newEccKeys.privateKey,
          revocationKey: newEccKeys.revocationKey,
        },
      };
      const preCreateUserDto: RegisterPreCreatedUserDto = {
        name: 'My',
        lastname: 'Internxt',
        email: 'test@test.com',
        password: 'hashed password',
        mnemonic: 'mnemonic',
        salt: 'salt',
        privateKey: newEccKeys.privateKey,
        publicKey: newEccKeys.publicKey,
        revocationKey: newEccKeys.revocationKey,
        invitationId: v4(),
        referrer: null,
        registerCompleted: true,
      };

      keyServerUseCases.parseKeysInput.mockReturnValueOnce(newKeys);
      userUseCases.findPreCreatedByEmail.mockResolvedValueOnce(preCreatedUser);
      userUseCases.createUser.mockResolvedValueOnce(mockCreateUserResponse);
      keyServerUseCases.addKeysToUser.mockResolvedValueOnce({
        kyber: newKyberKeys,
        ecc: newEccKeys,
      });

      const result = await userController.registerPreCreatedUser(
        preCreateUserDto,
        req,
      );

      expect((result as any).user).toMatchObject({
        publicKey: newKeys.ecc.publicKey,
        privateKey: newKeys.ecc.privateKey,
        revocationKey: newKeys.ecc.revocationKey,
        keys: newKeys,
      });
    });

    it('When the pre-created user is registered without keys, then replacing pre created user invitations should be skipped', async () => {
      const preCreateUserDto: RegisterPreCreatedUserDto = {
        name: 'My',
        lastname: 'Internxt',
        email: 'test@test.com',
        password: 'hashed password',
        mnemonic: 'mnemonic',
        salt: 'salt',
        invitationId: v4(),
      };

      userUseCases.findPreCreatedByEmail.mockResolvedValueOnce(preCreatedUser);
      userUseCases.createUser.mockResolvedValueOnce(mockCreateUserResponse);
      keyServerUseCases.addKeysToUser.mockResolvedValueOnce({
        kyber: null,
        ecc: null,
      });

      await userController.registerPreCreatedUser(preCreateUserDto, req);

      expect(userUseCases.replacePreCreatedUser).not.toHaveBeenCalled();
    });
  });

  describe('GET /public-key/:email', () => {
    const mockUser = newUser();

    it('When public keys are requested, then it should return the publicKey field for backward compatibility', async () => {
      const kyberKeys = newKeyServer({
        userId: mockUser.id,
        encryptVersion: UserKeysEncryptVersions.Kyber,
      });
      const eccKeys = newKeyServer({ userId: mockUser.id });

      keyServerUseCases.getPublicKeys.mockResolvedValueOnce({
        kyber: kyberKeys.publicKey,
        ecc: eccKeys.publicKey,
      });

      const response = await userController.getPublicKeyByEmail(mockUser.email);

      expect(response.publicKey).toEqual(eccKeys.publicKey);
    });

    it('When public keys are requested, then it should return the keys object containing public keys for each encryption method', async () => {
      const kyberKeys = newKeyServer({
        userId: mockUser.id,
        encryptVersion: UserKeysEncryptVersions.Kyber,
      });
      const eccKeys = newKeyServer({ userId: mockUser.id });

      keyServerUseCases.getPublicKeys.mockResolvedValueOnce({
        kyber: kyberKeys.publicKey,
        ecc: eccKeys.publicKey,
      });

      const response = await userController.getPublicKeyByEmail(mockUser.email);

      expect(response.keys).toMatchObject({
        kyber: kyberKeys.publicKey,
        ecc: eccKeys.publicKey,
      });
    });

    it('When public keys are requested and user does not have keys, then it should return empty keys object and public key', async () => {
      keyServerUseCases.getPublicKeys.mockResolvedValueOnce({
        kyber: null,
        ecc: null,
      });

      const response = await userController.getPublicKeyByEmail(mockUser.email);

      expect(response.keys).toMatchObject({
        kyber: null,
        ecc: null,
      });
      expect(response.publicKey).toEqual(null);
    });
  });

  describe('PUT /public-key/:email', () => {
    const mockUser = newUser();
    const requestingUser = newUser();

    it('When user exists, then it should return existing public keys', async () => {
      const mockResponse = {
        publicKey: 'existing-ecc-key',
        publicKyberKey: 'existing-kyber-key',
      };

      userUseCases.getOrPreCreateUser.mockResolvedValueOnce(mockResponse);

      const result = await userController.getOrPreCreatePublicKeyByEmail(
        mockUser.email,
        requestingUser,
      );

      expect(userUseCases.getOrPreCreateUser).toHaveBeenCalledWith(
        mockUser.email,
        requestingUser,
      );
      expect(result).toEqual(mockResponse);
    });

    it('When user does not exist, then it should pre-create user and return new keys', async () => {
      const mockResponse = {
        publicKey: 'new-ecc-key',
        publicKyberKey: 'new-kyber-key',
      };

      userUseCases.getOrPreCreateUser.mockResolvedValueOnce(mockResponse);

      const result = await userController.getOrPreCreatePublicKeyByEmail(
        'nonexistent@example.com',
        requestingUser,
      );

      expect(userUseCases.getOrPreCreateUser).toHaveBeenCalledWith(
        'nonexistent@example.com',
        requestingUser,
      );
      expect(result).toEqual(mockResponse);
    });

    it('When getOrPreCreateUser throws an error, then it should propagate the error', async () => {
      const error = new Error('Database error');
      userUseCases.getOrPreCreateUser.mockRejectedValueOnce(error);

      await expect(
        userController.getOrPreCreatePublicKeyByEmail(
          mockUser.email,
          requestingUser,
        ),
      ).rejects.toThrow(error);

      expect(userUseCases.getOrPreCreateUser).toHaveBeenCalledWith(
        mockUser.email,
        requestingUser,
      );
    });
  });

  describe('POST /deactivation/send', () => {
    const mockUser = newUser();
    const mockRequest = createMock<Request>();

    it('When deactivation email is sent successfully, then the notifications service is called', async () => {
      const notificationsSpy = jest.spyOn(notificationService, 'add');

      await userController.sendUserDeactivationEmail(mockUser, mockRequest);

      expect(userUseCases.sendDeactivationEmail).toHaveBeenCalledWith(mockUser);
      expect(notificationsSpy).toHaveBeenCalledWith(
        expect.any(DeactivationRequestEvent),
      );
    });

    it('When sending deactivation email fails, then it throws', async () => {
      userUseCases.sendDeactivationEmail.mockRejectedValueOnce(
        new Error('Deactivation failed'),
      );

      await expect(
        userController.sendUserDeactivationEmail(mockUser, mockRequest),
      ).rejects.toThrow();

      expect(userUseCases.sendDeactivationEmail).toHaveBeenCalledWith(mockUser);
      expect(notificationService.add).not.toHaveBeenCalled();
    });
  });

  describe('POST /deactivation/confirm', () => {
    it('When deactivation is confirmed, then the service is called with the received token', async () => {
      const token = 'deactivationToken';
      const user = newUser();
      jest
        .spyOn(userUseCases, 'confirmDeactivation')
        .mockResolvedValueOnce(user);
      await userController.confirmUserDeactivation({ token });

      expect(userUseCases.confirmDeactivation).toHaveBeenCalledWith(token);
    });
  });

  describe('GET /storage/usage', () => {
    const user = newUser();

    it('When storage usage is requested, then it should return the user usage data', async () => {
      const driveUsage = 1024000;
      const backupUsage = 2048000;
      const totalUsage = driveUsage + backupUsage;
      const mockUsage = {
        drive: driveUsage,
        backup: backupUsage,
        total: totalUsage,
      };

      userUseCases.getUserUsage.mockResolvedValueOnce(mockUsage);

      const result = await userController.getUserUsage(user);

      expect(userUseCases.getUserUsage).toHaveBeenCalledWith(user);
      expect(result).toEqual(mockUsage);
    });

    it('When getUserUsage throws an error, then it should propagate the error', async () => {
      const errorMessage = 'Failed to get storage usage';

      userUseCases.getUserUsage.mockRejectedValueOnce(new Error(errorMessage));

      await expect(userController.getUserUsage(user)).rejects.toThrow(Error);
      expect(userUseCases.getUserUsage).toHaveBeenCalledWith(user);
    });
  });

  describe('limit', () => {
    const userMocked = newUser();
    it('When a valid user is provided, then it should return the space limit', async () => {
      const maxSpaceBytes = 1000000000;
      jest
        .spyOn(userUseCases, 'getSpaceLimit')
        .mockResolvedValue(maxSpaceBytes);

      const result = await userController.limit(userMocked);

      expect(userUseCases.getSpaceLimit).toHaveBeenCalledWith(userMocked);
      expect(result).toEqual({ maxSpaceBytes });
    });

    it('When an error occurs while getting the space limit, then it should log the error and throw it', async () => {
      const errorMessage = 'Error getting space limit';
      jest
        .spyOn(userUseCases, 'getSpaceLimit')
        .mockRejectedValue(new Error(errorMessage));
      const consoleErrorSpy = jest
        .spyOn(Logger, 'error')
        .mockImplementation(() => {});

      await expect(userController.limit(userMocked)).rejects.toThrow(
        errorMessage,
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `[SPACE_LIMIT] Error getting space limit for user: ${userMocked.id}. Error: ${errorMessage}`,
        ),
      );
    });
  });

  describe('PUT /recover-account', () => {
    const mockUser = newUser();
    const validToken = SignWithCustomDuration(
      {
        payload: {
          uuid: mockUser.uuid,
          action: 'recover-account',
        },
      },
      getEnv().secrets.jwt,
      '30m',
    );

    const mockRecoverAccountDto: DeprecatedRecoverAccountDto = {
      mnemonic: 'encrypted_mnemonic',
      password: 'encrypted_password',
      salt: 'encrypted_salt',
      privateKey: 'encrypted_private_key',
    };

    const mockRecoverAccountNoKeys: DeprecatedRecoverAccountDto = {
      mnemonic: 'encrypted_mnemonic',
      password: 'encrypted_password',
      salt: 'encrypted_salt',
    };

    beforeEach(() => {
      jest.clearAllMocks();

      jest
        .spyOn(userUseCases, 'updateCredentialsOld')
        .mockResolvedValue(undefined);

      (jwtUtils.verifyToken as jest.Mock).mockReturnValue({
        payload: {
          uuid: mockUser.uuid,
          action: 'recover-account',
        },
      });
    });

    it('When token is invalid, then it throws ForbiddenException', async () => {
      (jwtUtils.verifyToken as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const invalidToken = 'invalid_token';
      await expect(
        userController.recoverAccount(
          {
            token: invalidToken,
            reset: 'false',
          },
          mockRecoverAccountDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When token has valid signature but incorrect properties, then it throws ForbiddenException', async () => {
      (jwtUtils.verifyToken as jest.Mock).mockReturnValueOnce({
        payload: {
          uuid: 'invalid_uuid',
          action: 'wrong_action',
        },
      });

      await expect(
        userController.recoverAccount(
          {
            token: validToken,
            reset: 'false',
          },
          mockRecoverAccountDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When reset is true, then it updates credentials with reset option', async () => {
      await userController.recoverAccount(
        {
          token: validToken,
          reset: 'true',
        },
        mockRecoverAccountNoKeys,
      );

      expect(userUseCases.updateCredentialsOld).toHaveBeenCalledWith(
        mockUser.uuid,
        {
          mnemonic: mockRecoverAccountNoKeys.mnemonic,
          password: mockRecoverAccountNoKeys.password,
          salt: mockRecoverAccountNoKeys.salt,
        },
        true,
      );
    });

    it('When reset is false and private key is provided, then it updates credentials with private key', async () => {
      await userController.recoverAccount(
        {
          token: validToken,
          reset: 'false',
        },
        mockRecoverAccountDto,
      );

      expect(userUseCases.updateCredentialsOld).toHaveBeenCalledWith(
        mockUser.uuid,
        {
          mnemonic: mockRecoverAccountDto.mnemonic,
          password: mockRecoverAccountDto.password,
          salt: mockRecoverAccountDto.salt,
          privateKey: mockRecoverAccountDto.privateKey,
        },
      );
    });

    it('When reset is false but no private key is provided, then it still works (original behavior)', async () => {
      await userController.recoverAccount(
        {
          token: validToken,
          reset: 'false',
        },
        mockRecoverAccountNoKeys,
      );

      expect(userUseCases.updateCredentialsOld).toHaveBeenCalledWith(
        mockUser.uuid,
        {
          mnemonic: mockRecoverAccountNoKeys.mnemonic,
          password: mockRecoverAccountNoKeys.password,
          salt: mockRecoverAccountNoKeys.salt,
          privateKey: undefined,
        },
      );
    });

    it('When account recovery succeeds, then the action is logged as expected', async () => {
      await userController.recoverAccount(
        {
          token: validToken,
          reset: 'false',
        },
        mockRecoverAccountDto,
      );

      expect(auditLogService.log).toHaveBeenCalledWith({
        entityType: AuditEntityType.User,
        entityId: mockUser.uuid,
        action: AuditAction.AccountRecovery,
        performerType: AuditPerformerType.User,
        performerId: mockUser.uuid,
      });
    });

    it('When account reset succeeds, then the action is logged as expected', async () => {
      await userController.recoverAccount(
        {
          token: validToken,
          reset: 'true',
        },
        mockRecoverAccountNoKeys,
      );

      expect(auditLogService.log).toHaveBeenCalledWith({
        entityType: AuditEntityType.User,
        entityId: mockUser.uuid,
        action: AuditAction.AccountReset,
        performerType: AuditPerformerType.User,
        performerId: mockUser.uuid,
      });
    });
  });

  describe('PUT /recover-account-v2', () => {
    const mockUser = newUser();
    const validToken = SignWithCustomDuration(
      {
        payload: {
          uuid: mockUser.uuid,
          action: 'recover-account',
        },
      },
      getEnv().secrets.jwt,
      '30m',
    );

    const mockRecoverAccountDto: RecoverAccountDto = {
      mnemonic: 'encrypted_mnemonic',
      password: 'encrypted_password',
      salt: 'encrypted_salt',
      uuid: mockUser.uuid,
      privateKeys: {
        ecc: 'encrypted_ecc_key',
        kyber: 'encrypted_kyber_key',
      },
    };

    const mockRecoverAccountNoKeys: RecoverAccountDto = {
      mnemonic: 'encrypted_mnemonic',
      password: 'encrypted_password',
      uuid: mockUser.uuid,
      salt: 'encrypted_salt',
    };

    beforeEach(() => {
      jest.clearAllMocks();

      jest
        .spyOn(userUseCases, 'updateCredentials')
        .mockResolvedValue(undefined);

      (jwtUtils.verifyToken as jest.Mock).mockReturnValue({
        payload: {
          uuid: mockUser.uuid,
          action: 'recover-account',
        },
      });
    });

    it('When token is invalid, then it throws ForbiddenException', async () => {
      (jwtUtils.verifyToken as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const invalidToken = 'invalid_token';
      await expect(
        userController.recoverAccountV2(
          {
            token: invalidToken,
            reset: 'false',
          },
          mockRecoverAccountDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When token has valid signature but incorrect properties, then it throws ForbiddenException', async () => {
      (jwtUtils.verifyToken as jest.Mock).mockReturnValueOnce({
        payload: {
          uuid: 'invalid_uuid',
          action: 'wrong_action',
        },
      });

      await expect(
        userController.recoverAccountV2(
          {
            token: validToken,
            reset: 'false',
          },
          mockRecoverAccountDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When reset is true, then it updates credentials with reset option', async () => {
      await userController.recoverAccountV2(
        {
          token: validToken,
          reset: 'true',
        },
        mockRecoverAccountNoKeys,
      );

      expect(userUseCases.updateCredentials).toHaveBeenCalledWith(
        mockUser.uuid,
        {
          mnemonic: mockRecoverAccountNoKeys.mnemonic,
          password: mockRecoverAccountNoKeys.password,
          salt: mockRecoverAccountNoKeys.salt,
          publicKeys: undefined,
        },
        true,
      );
    });

    it('When reset is false and private keys are provided, then it updates credentials with private keys', async () => {
      await userController.recoverAccountV2(
        {
          token: validToken,
          reset: 'false',
        },
        mockRecoverAccountDto,
      );

      expect(userUseCases.updateCredentials).toHaveBeenCalledWith(
        mockUser.uuid,
        {
          mnemonic: mockRecoverAccountDto.mnemonic,
          password: mockRecoverAccountDto.password,
          salt: mockRecoverAccountDto.salt,
          privateKeys: mockRecoverAccountDto.privateKeys,
          publicKeys: undefined,
        },
        false,
      );
    });

    it('When reset is false but no private keys are provided, then it throws BadRequestException', async () => {
      await expect(
        userController.recoverAccountV2(
          {
            token: validToken,
            reset: 'false',
          },
          mockRecoverAccountNoKeys,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(userUseCases.updateCredentials).not.toHaveBeenCalled();
    });

    it('When reset parameter has invalid value, then token validation still works', async () => {
      await userController.recoverAccountV2(
        {
          token: validToken,
          reset: 'invalid_value',
        },
        mockRecoverAccountDto,
      );

      expect(userUseCases.updateCredentials).toHaveBeenCalledWith(
        mockUser.uuid,
        {
          mnemonic: mockRecoverAccountDto.mnemonic,
          password: mockRecoverAccountDto.password,
          salt: mockRecoverAccountDto.salt,
          privateKeys: mockRecoverAccountDto.privateKeys,
          publicKeys: undefined,
        },
        false,
      );
    });

    it('When reset is false, private keys are provided but the uuid does not match, then it throws BadRequestException', async () => {
      await expect(
        userController.recoverAccountV2(
          { token: validToken, reset: 'false' },
          {
            ...mockRecoverAccountDto,
            uuid: 'invalid_uuid',
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When reset is false, private keys are provided and the uuid is not provided, then it updates credentials with private keys', async () => {
      await userController.recoverAccountV2(
        { token: validToken, reset: 'false' },
        {
          ...mockRecoverAccountDto,
          uuid: undefined,
        },
      );

      expect(userUseCases.updateCredentials).toHaveBeenCalledWith(
        mockUser.uuid,
        {
          mnemonic: mockRecoverAccountDto.mnemonic,
          password: mockRecoverAccountDto.password,
          salt: mockRecoverAccountDto.salt,
          privateKeys: mockRecoverAccountDto.privateKeys,
          publicKeys: undefined,
        },
        false,
      );
    });

    it('When account recovery succeeds, then the action is logged as expected', async () => {
      await userController.recoverAccountV2(
        {
          token: validToken,
          reset: 'false',
        },
        mockRecoverAccountDto,
      );

      expect(auditLogService.log).toHaveBeenCalledWith({
        entityType: AuditEntityType.User,
        entityId: mockUser.uuid,
        action: AuditAction.AccountRecovery,
        performerType: AuditPerformerType.User,
        performerId: mockUser.uuid,
      });
    });

    it('When account reset succeeds, then the action is logged as expected', async () => {
      await userController.recoverAccountV2(
        {
          token: validToken,
          reset: 'true',
        },
        mockRecoverAccountNoKeys,
      );

      expect(auditLogService.log).toHaveBeenCalledWith({
        entityType: AuditEntityType.User,
        entityId: mockUser.uuid,
        action: AuditAction.AccountReset,
        performerType: AuditPerformerType.User,
        performerId: mockUser.uuid,
      });
    });
  });

  describe('PUT /legacy-recover-account', () => {
    const mockUser = newUser();
    const mockLegacyRecoverAccountDto: LegacyRecoverAccountDto = {
      token: 'valid_token',
      mnemonic: 'encrypted_mnemonic',
      password: 'encrypted_password',
      salt: 'encrypted_salt',
      asymmetricEncryptedMnemonic: {
        ecc: 'encrypted_mnemonic_ecc',
        hybrid: 'encrypted_mnemonic_hybrid',
      },
      keys: {
        ecc: {
          private: 'private_ecc_key',
          public: 'public_ecc_key',
          revocationKey: 'revocation_key',
        },
        kyber: {
          private: 'private_kyber_key',
          public: 'public_kyber_key',
        },
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();

      jest
        .spyOn(userUseCases, 'verifyAndDecodeAccountRecoveryToken')
        .mockReturnValue({
          userUuid: mockUser.uuid,
        });

      jest
        .spyOn(userUseCases, 'recoverAccountLegacy')
        .mockResolvedValue(undefined);
    });

    it('When token is provided and valid, then it recovers account with legacy method', async () => {
      await userController.requestLegacyAccountRecovery(
        mockLegacyRecoverAccountDto,
      );

      expect(
        userUseCases.verifyAndDecodeAccountRecoveryToken,
      ).toHaveBeenCalledWith(mockLegacyRecoverAccountDto.token);
      expect(userUseCases.recoverAccountLegacy).toHaveBeenCalledWith(
        mockUser.uuid,
        mockLegacyRecoverAccountDto,
      );
    });

    it('When token verification fails, then it should propagate the error', async () => {
      const tokenError = new ForbiddenException('Invalid token');
      jest
        .spyOn(userUseCases, 'verifyAndDecodeAccountRecoveryToken')
        .mockImplementation(() => {
          throw tokenError;
        });

      await expect(
        userController.requestLegacyAccountRecovery(
          mockLegacyRecoverAccountDto,
        ),
      ).rejects.toThrow(tokenError);

      expect(userUseCases.recoverAccountLegacy).not.toHaveBeenCalled();
    });

    it('When legacy recovery fails, then it should propagate the error', async () => {
      const recoveryError = new Error('Recovery failed');
      jest
        .spyOn(userUseCases, 'recoverAccountLegacy')
        .mockRejectedValue(recoveryError);

      await expect(
        userController.requestLegacyAccountRecovery(
          mockLegacyRecoverAccountDto,
        ),
      ).rejects.toThrow(recoveryError);

      expect(
        userUseCases.verifyAndDecodeAccountRecoveryToken,
      ).toHaveBeenCalledWith(mockLegacyRecoverAccountDto.token);
    });
  });

  describe('GET /me/upload-status', () => {
    const userMocked = newUser();

    it('When user has uploaded files, then it should return hasUploadedFiles as true', async () => {
      userUseCases.hasUploadedFiles.mockResolvedValueOnce(true);

      const result = await userController.getUploadStatus(userMocked);

      expect(userUseCases.hasUploadedFiles).toHaveBeenCalledWith(userMocked);
      expect(result).toEqual({ hasUploadedFiles: true });
    });

    it('When user has not uploaded files, then it should return hasUploadedFiles as false', async () => {
      userUseCases.hasUploadedFiles.mockResolvedValueOnce(false);

      const result = await userController.getUploadStatus(userMocked);

      expect(userUseCases.hasUploadedFiles).toHaveBeenCalledWith(userMocked);
      expect(result).toEqual({ hasUploadedFiles: false });
    });

    it('When an error occurs while checking upload status, then it should throw the error', async () => {
      const errorMessage = 'Database error';
      userUseCases.hasUploadedFiles.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await expect(userController.getUploadStatus(userMocked)).rejects.toThrow(
        errorMessage,
      );
      expect(userUseCases.hasUploadedFiles).toHaveBeenCalledWith(userMocked);
    });
  });

  describe('POST /payments/incomplete-checkout', () => {
    const mockUser = newUser({ attributes: { email: 'test@internxt.com' } });
    const mockIncompleteCheckoutDto: IncompleteCheckoutDto = {
      completeCheckoutUrl: 'https://drive.internxt.com/checkout/complete',
      planName: 'Premium',
      price: 9.99,
    };

    it('When valid user and dto are provided, then should return success message', async () => {
      const expectedResult = {
        success: true,
        message: 'Checkout event tracked successfully',
      };

      const result = await userController.handleIncompleteCheckout(
        mockUser,
        mockIncompleteCheckoutDto,
      );

      expect(result).toEqual(expectedResult);
    });

    it('When different user is provided, then should return success message', async () => {
      const differentUser = newUser({
        attributes: { email: 'different@internxt.com' },
      });
      const expectedResult = {
        success: true,
        message: 'Checkout event tracked successfully',
      };

      const result = await userController.handleIncompleteCheckout(
        differentUser,
        mockIncompleteCheckoutDto,
      );

      expect(result).toEqual(expectedResult);
    });

    it('When Klaviyo service throws error, then should log error and return success', async () => {
      const mockError = new Error('Klaviyo service unavailable');
      jest
        .spyOn(klaviyoService, 'trackCheckoutStarted')
        .mockRejectedValue(mockError);
      const loggerErrorSpy = jest.spyOn(Logger, 'error').mockImplementation();

      const result = await userController.handleIncompleteCheckout(
        mockUser,
        mockIncompleteCheckoutDto,
      );

      expect(result).toEqual({
        success: true,
        message: 'Checkout event tracked successfully',
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `[KLAVIYO] Failed to track checkout for ${mockUser.email}: ${mockError.message}`,
      );

      loggerErrorSpy.mockRestore();
    });
  });
});
