import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { v4 } from 'uuid';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import getEnv from '../../config/configuration';
import { UserController } from './user.controller';
import { MailLimitReachedException, UserUseCases } from './user.usecase';
import { NotificationService } from '../../externals/notifications/notification.service';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { SharingService } from '../sharing/sharing.service';
import { SignWithCustomDuration } from '../../middlewares/passport';
import {
  generateBase64PrivateKeyStub,
  newKeyServer,
  newPreCreatedUser,
  newUser,
} from '../../../test/fixtures';
import { AccountTokenAction, User } from './user.domain';
import { DeviceType } from './dto/register-notification-token.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserKeysEncryptVersions } from '../keyserver/key-server.domain';
import { RegisterPreCreatedUserDto } from './dto/register-pre-created-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

jest.mock('../../config/configuration', () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      secrets: {
        jwt: 'Test',
        jitsiSecret: generateBase64PrivateKeyStub(),
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

describe('User Controller', () => {
  let userController: UserController;
  let userUseCases: DeepMocked<UserUseCases>;
  let notificationService: DeepMocked<NotificationService>;
  let keyServerUseCases: DeepMocked<KeyServerUseCases>;
  let cryptoService: DeepMocked<CryptoService>;
  let sharingService: DeepMocked<SharingService>;

  beforeEach(async () => {
    userUseCases = createMock<UserUseCases>();
    notificationService = createMock<NotificationService>();
    keyServerUseCases = createMock<KeyServerUseCases>();
    cryptoService = createMock<CryptoService>();
    sharingService = createMock<SharingService>();

    userController = new UserController(
      userUseCases,
      notificationService,
      keyServerUseCases,
      cryptoService,
      sharingService,
    );
  });

  it('should be defined', () => {
    expect(userController).toBeDefined();
  });

  describe('POST /unblock-account', () => {
    it('When an unhandled error is returned, then error 500 is shown', async () => {
      userUseCases.sendAccountUnblockEmail.mockRejectedValueOnce(new Error());
      await expect(
        userController.requestAccountUnblock({ email: '' }),
      ).rejects.toThrow(InternalServerErrorException);
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
        userController.uploadAvatar(mockAvatar as any, user),
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
  describe('POST /create-user', () => {
    const req = createMock<Request>({
      headers: { 'internxt-client': 'drive-web' } as any,
    });
    const res = createMock<Response>();

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

      userUseCases.createUser.mockResolvedValueOnce(mockCreateUserResponse);
      keyServerUseCases.addKeysToUser.mockResolvedValueOnce({
        kyber: newKyberKeys,
        ecc: newEccKeys,
      });

      const result = await userController.createUser(
        createUserDto,
        req as any,
        res as any,
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

    it('When the user is created with old ecc keys, then the user and keys should be created successfully', async () => {
      const newEccKeys = newKeyServer({ userId: mockUser.id });

      const createUserDto: CreateUserDto = {
        name: 'My',
        lastname: 'Internxt',
        email: 'test@test.com',
        password: 'hashed password',
        mnemonic: 'mnemonic',
        salt: 'salt',
        publicKey: newEccKeys.publicKey,
        privateKey: newEccKeys.privateKey,
        revocationKey: newEccKeys.revocationKey,
      };

      userUseCases.createUser.mockResolvedValueOnce(mockCreateUserResponse);
      keyServerUseCases.addKeysToUser.mockResolvedValueOnce({
        kyber: null,
        ecc: newEccKeys,
      });

      const result = await userController.createUser(
        createUserDto,
        req as any,
        res as any,
      );

      expect(userUseCases.createUser).toHaveBeenCalledWith(createUserDto);
      expect(keyServerUseCases.addKeysToUser).toHaveBeenCalledWith(
        mockUser.id,
        {
          ecc: {
            publicKey: newEccKeys.publicKey,
            privateKey: newEccKeys.privateKey,
            revocationKey: newEccKeys.revocationKey,
          },
        },
      );
      expect((result as any).user).toMatchObject({
        publicKey: newEccKeys.publicKey,
        privateKey: newEccKeys.privateKey,
        revocationKey: newEccKeys.revocationKey,
        keys: {
          ecc: {
            publicKey: newEccKeys.publicKey,
            privateKey: newEccKeys.privateKey,
            revocationKey: newEccKeys.revocationKey,
          },
          kyber: null,
        },
      });
    });

    it('When the user is created and ecc keys are not sent nor found, then it should not try to replace pre created user', async () => {
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
        ecc: null,
      });

      await userController.createUser(createUserDto, req as any, res as any);

      expect(userUseCases.createUser).toHaveBeenCalledWith(createUserDto);
      expect(userUseCases.replacePreCreatedUser).not.toHaveBeenCalled();
    });

    it('When the user is created and ecc keys are found, then it should try to replace pre created user', async () => {
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

      await userController.createUser(createUserDto, req as any, res as any);

      expect(userUseCases.replacePreCreatedUser).toHaveBeenCalled();
    });
  });

  describe('POST /pre-created-users/register', () => {
    const res = createMock<Response>();
    const req = createMock<Request>({
      headers: { 'internxt-client': 'drive-web' } as any,
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

    it('When the pre-created user is registered with new keys object, then the user and keys should be created successfully', async () => {
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
        privateKey: 'privateKey',
        publicKey: 'publicKey',
        revocationKey: 'revocationKey',
        keys: newKeys,
        invitationId: v4(),
      };

      userUseCases.findPreCreatedByEmail.mockResolvedValueOnce(preCreatedUser);
      userUseCases.createUser.mockResolvedValueOnce(mockCreateUserResponse);
      keyServerUseCases.addKeysToUser.mockResolvedValueOnce({
        kyber: newKyberKeys,
        ecc: newEccKeys,
      });

      const result = await userController.registerPreCreatedUser(
        preCreateUserDto,
        req as any,
        res as any,
      );

      expect((result as any).user).toMatchObject({
        publicKey: newKeys.ecc.publicKey,
        privateKey: newKeys.ecc.privateKey,
        revocationKey: newKeys.ecc.revocationKey,
        keys: newKeys,
      });
    });

    it('When the pre-created user is registered without keys, then the user should skip replacing pre created user', async () => {
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

      await userController.registerPreCreatedUser(
        preCreateUserDto,
        req as any,
        res as any,
      );

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
        kyber: { publicKey: kyberKeys.publicKey },
        ecc: { publicKey: eccKeys.publicKey },
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
        kyber: { publicKey: kyberKeys.publicKey },
        ecc: { publicKey: eccKeys.publicKey },
      });

      const response = await userController.getPublicKeyByEmail(mockUser.email);

      expect(response.keys).toMatchObject({
        kyber: { publicKey: kyberKeys.publicKey },
        ecc: { publicKey: eccKeys.publicKey },
      });
    });

    it('When public keys are requested and user does not have keys, then it should return empty keys object and public key', async () => {
      keyServerUseCases.getPublicKeys.mockResolvedValueOnce({
        kyber: { publicKey: null },
        ecc: { publicKey: null },
      });

      const response = await userController.getPublicKeyByEmail(mockUser.email);

      expect(response.keys).toMatchObject({
        kyber: { publicKey: null },
        ecc: { publicKey: null },
      });
      expect(response.publicKey).toEqual(null);
    });
  });
});
