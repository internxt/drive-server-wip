import { DeepMocked, createMock } from '@golevelup/ts-jest';
import {
  ForbiddenException,
  InternalServerErrorException,
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
import { generateBase64PrivateKeyStub, newUser } from '../../../test/fixtures';
import { AccountTokenAction } from './user.domain';

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

  describe('GET /meet token', () => {
    const user = newUser();
    it('When token is requested and user is in the closed beta, then it generates a meet token', () => {
      userUseCases.getMeetClosedBetaUsers.mockReturnValue([user.email]);

      const result = userController.getMeetToken(user);
      expect(result.token).toBeDefined();
    });

    it('When token is requested and user is not in the closed beta, then it throws an error', () => {
      userUseCases.getMeetClosedBetaUsers.mockReturnValue([]);

      expect(() => {
        userController.getMeetToken(user);
      }).toThrow(UnauthorizedException);
    });
  });
});
