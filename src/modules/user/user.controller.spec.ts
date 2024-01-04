import { DeepMocked, createMock } from '@golevelup/ts-jest';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import getEnv from '../../config/configuration';
import { UserController } from './user.controller';
import { UserUseCases } from './user.usecase';
import { NotificationService } from '../../externals/notifications/notification.service';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { SharingService } from '../sharing/sharing.service';
import { SignWithCustomDuration } from '../../middlewares/passport';
import { newUser } from '../../../test/fixtures';
import { AccountTokenAction } from './user.domain';

jest.mock('../../config/configuration', () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      secrets: {
        jwt: 'Test',
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
    it('When user is not found, then returns NotFoundException', async () => {
      userUseCases.sendAccountUnblockEmail.mockRejectedValueOnce(
        new NotFoundException(),
      );
      await expect(
        userController.requestAccountUnblock({ email: 'test@test.com' }),
      ).rejects.toThrow(NotFoundException);
    });
    it('When an unexpected error is throw, then returns InternalServerException', async () => {
      userUseCases.sendAccountUnblockEmail.mockRejectedValueOnce(new Error());
      await expect(
        userController.requestAccountUnblock({ email: 'test@test.com' }),
      ).rejects.toThrow(InternalServerErrorException);
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

    it('When token is valid but useCase throws badRequest or Forbidden, then fails with respective error', async () => {
      userUseCases.unblockAccount
        .mockRejectedValueOnce(new BadRequestException())
        .mockRejectedValueOnce(new ForbiddenException());
      await expect(userController.accountUnblock(validToken)).rejects.toThrow(
        BadRequestException,
      );
      await expect(userController.accountUnblock(validToken)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('When token is valid but useCase throws unexpected error, then fails with InternalServerError', async () => {
      userUseCases.unblockAccount.mockRejectedValueOnce(new Error());
      await expect(userController.accountUnblock(validToken)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('When token and user are correct, then resolves', async () => {
      userUseCases.unblockAccount.mockResolvedValueOnce();
      await expect(
        userController.accountUnblock(validToken),
      ).resolves.toBeUndefined();
    });
  });
});
