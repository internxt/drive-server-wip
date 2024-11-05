import { DeepMocked, createMock } from '@golevelup/ts-jest';
import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import getEnv from '../../config/configuration';
import { UserController } from './user.controller';
import {
  KeyServerNotFoundError,
  MailLimitReachedException,
  UserUseCases,
} from './user.usecase';
import { NotificationService } from '../../externals/notifications/notification.service';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { SharingService } from '../sharing/sharing.service';
import { SignWithCustomDuration } from '../../middlewares/passport';
import { generateBase64PrivateKeyStub, newUser } from '../../../test/fixtures';
import { AccountTokenAction } from './user.domain';
import { v4 } from 'uuid';
import { DeviceType } from './dto/register-notification-token.dto';

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

  describe('PATCH /password', () => {
    const user = newUser();
    const payload = {
      newPassword: v4(),
      newSalt: v4(),
      mnemonic: v4(),
      privateKey: v4(),
      encryptVersion: null,
    };
    const mockTokens = {
      newToken: v4(),
      token: v4(),
    };

    it('When a new password is updated it should return the new tokens', async () => {
      userUseCases.updatePassword.mockResolvedValueOnce();
      userUseCases.getAuthTokens.mockReturnValueOnce(mockTokens);

      await expect(
        userController.updatePassword(payload, user),
      ).resolves.toStrictEqual({ status: 'success', ...mockTokens });
    });

    it('should throw an error if password update fails', async () => {
      userUseCases.updatePassword.mockRejectedValueOnce(
        new UnauthorizedException(),
      );

      await expect(
        userController.updatePassword(payload, user),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw an error if password update fails', async () => {
      userUseCases.updatePassword.mockRejectedValueOnce(
        new KeyServerNotFoundError(),
      );

      await expect(
        userController.updatePassword(payload, user),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw an error if fails', async () => {
      userUseCases.updatePassword.mockRejectedValueOnce(
        new InternalServerErrorException(),
      );

      await expect(
        userController.updatePassword(payload, user),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
