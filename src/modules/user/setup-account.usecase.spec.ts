import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { v4 } from 'uuid';
import { Sign } from '../../middlewares/passport';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { MailerService } from '../../externals/mailer/mailer.service';
import { newPreCreatedUser, newTier, newUser } from '../../../test/fixtures';
import { PreCreatedUserStatus } from './pre-created-users.attributes';
import { SequelizePreCreatedUsersRepository } from './pre-created-users.repository';
import { SetupAccountUseCase } from './setup-account.usecase';
import { SequelizeUserRepository } from './user.repository';
import { UserUseCases } from './user.usecase';
import { type PreCreatedUser } from './pre-created-user.domain';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { UserNotFoundException } from './exception/user-not-found.exception';

jest.mock('../../middlewares/passport', () => ({
  __esModule: true,
  ...jest.requireActual('../../middlewares/passport'),
  Sign: jest.fn(() => 'newToken'),
}));

describe('Setup account use cases', () => {
  let setupAccountUseCase: SetupAccountUseCase;
  let userRepository: DeepMocked<SequelizeUserRepository>;
  let preCreatedUsersRepository: DeepMocked<SequelizePreCreatedUsersRepository>;
  let bridgeService: DeepMocked<BridgeService>;
  let mailerService: DeepMocked<MailerService>;
  let userUseCases: DeepMocked<UserUseCases>;
  let featureLimitService: DeepMocked<FeatureLimitService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SetupAccountUseCase],
    })
      .useMocker(createMock)
      .compile();

    setupAccountUseCase = moduleRef.get(SetupAccountUseCase);
    userRepository = moduleRef.get(SequelizeUserRepository);
    preCreatedUsersRepository = moduleRef.get(
      SequelizePreCreatedUsersRepository,
    );
    bridgeService = moduleRef.get(BridgeService);
    mailerService = moduleRef.get(MailerService);
    userUseCases = moduleRef.get(UserUseCases);
    featureLimitService = moduleRef.get(FeatureLimitService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Pre-creating the user of a new customer at checkout', () => {
    const networkUuid = v4();
    const email = 'buyer@internxt.com';

    beforeEach(() => {
      userRepository.findByUsername.mockResolvedValue(null);
      preCreatedUsersRepository.findByUsername.mockResolvedValue(null);
      bridgeService.createUser.mockResolvedValue({
        userId: 'network-user',
        uuid: networkUuid,
      });
    });

    const toPreCreatedUserResult = (
      overrides: Partial<{ uuid: string; status: PreCreatedUserStatus }>,
    ) => ({
      id: 1,
      email,
      uuid: networkUuid,
      username: email,
      publicKyberKey: 'public-kyber-key',
      publicKey: 'public-key',
      password: '',
      status: PreCreatedUserStatus.AwaitingPayment,
      ...overrides,
    });

    test('When the email is new, then the user is pre-created with the network user uuid, awaiting the payment', async () => {
      userUseCases.preCreateUser.mockResolvedValueOnce([
        toPreCreatedUserResult({}),
        true,
      ]);

      const result =
        await setupAccountUseCase.createPreCreateUserForCheckout(
          'Buyer@Internxt.com',
        );

      expect(result).toEqual({
        uuid: networkUuid,
        status: PreCreatedUserStatus.AwaitingPayment,
      });
      expect(bridgeService.createUser).toHaveBeenCalledWith(email);
      expect(userUseCases.preCreateUser).toHaveBeenCalledWith(
        { email, status: PreCreatedUserStatus.AwaitingPayment },
        networkUuid,
      );
    });

    test('When the user is pre-created, then no setup email is sent', async () => {
      userUseCases.preCreateUser.mockResolvedValueOnce([
        toPreCreatedUserResult({}),
        true,
      ]);

      await setupAccountUseCase.createPreCreateUserForCheckout(email);

      expect(mailerService.sendAccountSetupEmail).not.toHaveBeenCalled();
    });

    test('When the email belongs to a registered user, then it is rejected as a conflict without touching the network', async () => {
      userRepository.findByUsername.mockResolvedValue(
        newUser({ attributes: { email } }),
      );

      await expect(
        setupAccountUseCase.createPreCreateUserForCheckout(email),
      ).rejects.toThrow(ConflictException);

      expect(bridgeService.createUser).not.toHaveBeenCalled();
      expect(userUseCases.preCreateUser).not.toHaveBeenCalled();
    });

    test('When the email is already pre-created, then it is rejected as a conflict without touching the network', async () => {
      preCreatedUsersRepository.findByUsername.mockResolvedValue(
        newPreCreatedUser(),
      );

      await expect(
        setupAccountUseCase.createPreCreateUserForCheckout(email),
      ).rejects.toThrow(ConflictException);

      expect(bridgeService.createUser).not.toHaveBeenCalled();
      expect(userUseCases.preCreateUser).not.toHaveBeenCalled();
    });
  });

  describe('Getting a pre-created user by email', () => {
    const email = 'buyer@internxt.com';

    test('When the user is pre-created and its setup is pending, then its uuid and status are returned', async () => {
      const preCreatedUser = newPreCreatedUser();
      preCreatedUser.status = PreCreatedUserStatus.PendingSetup;
      preCreatedUsersRepository.findByUsername.mockResolvedValue(
        preCreatedUser,
      );

      const result = await setupAccountUseCase.getPreCreatedUser(email);

      expect(result).toEqual({
        uuid: preCreatedUser.uuid,
        status: PreCreatedUserStatus.PendingSetup,
      });
    });

    test('When the user is pre-created and awaiting the payment, then its uuid and status are returned', async () => {
      const preCreatedUser = newPreCreatedUser();
      preCreatedUser.status = PreCreatedUserStatus.AwaitingPayment;
      preCreatedUsersRepository.findByUsername.mockResolvedValue(
        preCreatedUser,
      );

      const result = await setupAccountUseCase.getPreCreatedUser(email);

      expect(result).toEqual({
        uuid: preCreatedUser.uuid,
        status: PreCreatedUserStatus.AwaitingPayment,
      });
    });

    test('When the email has uppercase letters, then the user is looked up by the lowercase email', async () => {
      preCreatedUsersRepository.findByUsername.mockResolvedValue(
        newPreCreatedUser(),
      );

      await setupAccountUseCase.getPreCreatedUser('Buyer@Internxt.COM');

      expect(preCreatedUsersRepository.findByUsername).toHaveBeenCalledWith(
        email,
      );
    });

    test('When the email is not pre-created, then it is reported as not found', async () => {
      preCreatedUsersRepository.findByUsername.mockResolvedValue(null);

      await expect(
        setupAccountUseCase.getPreCreatedUser(email),
      ).rejects.toThrow(UserNotFoundException);
    });

    test('When the email only belongs to a registered user, then it is reported as not found without consulting the registered users', async () => {
      userRepository.findByUsername.mockResolvedValue(
        newUser({ attributes: { email } }),
      );
      preCreatedUsersRepository.findByUsername.mockResolvedValue(null);

      await expect(
        setupAccountUseCase.getPreCreatedUser(email),
      ).rejects.toThrow(UserNotFoundException);

      expect(userRepository.findByUsername).not.toHaveBeenCalled();
      expect(userRepository.findByEmail).not.toHaveBeenCalled();
    });
  });

  describe('Sending the account setup email after the payment', () => {
    const planName = 'Premium 2TB';
    const hostDriveWeb = 'https://drive.internxt.com';
    let preCreatedUser: PreCreatedUser;

    beforeEach(() => {
      process.env.HOST_DRIVE_WEB = hostDriveWeb;
      preCreatedUser = newPreCreatedUser();
      preCreatedUser.setupEmailSentAt = null;
    });

    test('When the pre-created user has not received it yet, then the email is sent with the plan name and a single-purpose link that expires in 5 days', async () => {
      jest
        .spyOn(preCreatedUsersRepository, 'findByUuid')
        .mockResolvedValue(preCreatedUser);

      await setupAccountUseCase.sendFirstAccountSetupEmail(
        preCreatedUser.uuid,
        planName,
      );

      expect(mailerService.sendAccountSetupEmail).toHaveBeenCalledWith(
        preCreatedUser.email,
        { planName, setupUrl: `${hostDriveWeb}/complete-account/newToken` },
      );
      expect(Sign).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            uuid: preCreatedUser.uuid,
            action: 'complete-account-setup',
          },
        }),
        undefined,
        '5d',
      );
    });

    test('When the email is sent, then the moment it was sent is stored and matches the link token', async () => {
      jest
        .spyOn(preCreatedUsersRepository, 'findByUuid')
        .mockResolvedValue(preCreatedUser);

      await setupAccountUseCase.sendFirstAccountSetupEmail(
        preCreatedUser.uuid,
        planName,
      );

      const [[, { setupEmailSentAt }]] = jest.mocked(
        preCreatedUsersRepository.updateByUuid,
      ).mock.calls;
      const [[{ iat }]] = jest.mocked(Sign).mock.calls as unknown as [
        [{ iat: number }],
      ];
      expect(preCreatedUsersRepository.updateByUuid).toHaveBeenCalledWith(
        preCreatedUser.uuid,
        {
          setupEmailSentAt: expect.any(Date),
          status: PreCreatedUserStatus.PendingSetup,
        },
      );
      expect(iat).toBe(Math.floor(setupEmailSentAt.getTime() / 1000));
    });

    test('When the email cannot be sent, then it is not marked as sent so a retry sends it', async () => {
      jest
        .spyOn(preCreatedUsersRepository, 'findByUuid')
        .mockResolvedValue(preCreatedUser);
      jest
        .spyOn(mailerService, 'sendAccountSetupEmail')
        .mockRejectedValueOnce(new Error('SendGrid is down'));

      await expect(
        setupAccountUseCase.sendFirstAccountSetupEmail(
          preCreatedUser.uuid,
          planName,
        ),
      ).rejects.toThrow('SendGrid is down');

      expect(preCreatedUsersRepository.updateByUuid).not.toHaveBeenCalled();
    });

    test('When the user cancelled and paid again, then a new setup email is sent', async () => {
      preCreatedUser.setupEmailSentAt = new Date('2026-09-20T10:00:00Z');
      preCreatedUser.status = PreCreatedUserStatus.AwaitingPayment;
      jest
        .spyOn(preCreatedUsersRepository, 'findByUuid')
        .mockResolvedValue(preCreatedUser);

      await setupAccountUseCase.sendFirstAccountSetupEmail(
        preCreatedUser.uuid,
        planName,
      );

      expect(mailerService.sendAccountSetupEmail).toHaveBeenCalledTimes(1);
      expect(preCreatedUsersRepository.updateByUuid).toHaveBeenCalledWith(
        preCreatedUser.uuid,
        expect.objectContaining({ status: PreCreatedUserStatus.PendingSetup }),
      );
    });

    test('When the email was already sent, then it is not sent again', async () => {
      preCreatedUser.setupEmailSentAt = new Date('2026-09-20T10:00:00Z');
      preCreatedUser.status = PreCreatedUserStatus.PendingSetup;
      jest
        .spyOn(preCreatedUsersRepository, 'findByUuid')
        .mockResolvedValue(preCreatedUser);

      await setupAccountUseCase.sendFirstAccountSetupEmail(
        preCreatedUser.uuid,
        planName,
      );

      expect(mailerService.sendAccountSetupEmail).not.toHaveBeenCalled();
      expect(preCreatedUsersRepository.updateByUuid).not.toHaveBeenCalled();
    });

    test('When the uuid belongs to a registered user, then nothing is sent', async () => {
      const registeredUser = newUser();
      jest
        .spyOn(preCreatedUsersRepository, 'findByUuid')
        .mockResolvedValue(null);
      jest
        .spyOn(userRepository, 'findByUuid')
        .mockResolvedValue(registeredUser);

      await setupAccountUseCase.sendFirstAccountSetupEmail(
        registeredUser.uuid,
        planName,
      );

      expect(mailerService.sendAccountSetupEmail).not.toHaveBeenCalled();
    });

    test('When the uuid belongs to no user, then it is reported as not found', async () => {
      jest
        .spyOn(preCreatedUsersRepository, 'findByUuid')
        .mockResolvedValue(null);
      jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(null);

      await expect(
        setupAccountUseCase.sendFirstAccountSetupEmail(v4(), planName),
      ).rejects.toThrow(NotFoundException);

      expect(mailerService.sendAccountSetupEmail).not.toHaveBeenCalled();
    });
  });

  describe('Updating the pre-created user of a customer at checkout', () => {
    let preCreatedUser: PreCreatedUser;

    beforeEach(() => {
      preCreatedUser = newPreCreatedUser();
      jest
        .spyOn(preCreatedUsersRepository, 'findByUuid')
        .mockResolvedValue(preCreatedUser);
      jest
        .spyOn(featureLimitService, 'getTier')
        .mockResolvedValue(newTier({ id: preCreatedUser.tierId }));
    });

    test('When the pre-created user does not exist, then it is reported as not found', async () => {
      jest
        .spyOn(preCreatedUsersRepository, 'findByUuid')
        .mockResolvedValue(null);

      await expect(
        setupAccountUseCase.updatePreCreatedUserForCheckout(v4(), {
          newTierId: v4(),
        }),
      ).rejects.toThrow(UserNotFoundException);

      expect(preCreatedUsersRepository.updateByUuid).not.toHaveBeenCalled();
      expect(bridgeService.setStorage).not.toHaveBeenCalled();
    });

    test('When the tier does not exist, then it is rejected as a bad request', async () => {
      jest.spyOn(featureLimitService, 'getTier').mockResolvedValue(null);
      const newTierId = v4();

      await expect(
        setupAccountUseCase.updatePreCreatedUserForCheckout(
          preCreatedUser.uuid,
          { newTierId },
        ),
      ).rejects.toThrow(BadRequestException);

      expect(featureLimitService.getTier).toHaveBeenCalledWith(newTierId);
      expect(preCreatedUsersRepository.updateByUuid).not.toHaveBeenCalled();
      expect(bridgeService.setStorage).not.toHaveBeenCalled();
    });

    test('When a new tier and status are given, then both are stored', async () => {
      const newTierId = v4();
      jest
        .spyOn(featureLimitService, 'getTier')
        .mockResolvedValue(newTier({ id: newTierId }));

      await setupAccountUseCase.updatePreCreatedUserForCheckout(
        preCreatedUser.uuid,
        { newTierId, status: PreCreatedUserStatus.Cancelled },
      );

      expect(preCreatedUsersRepository.updateByUuid).toHaveBeenCalledWith(
        preCreatedUser.uuid,
        { tierId: newTierId, status: PreCreatedUserStatus.Cancelled },
      );
    });

    test('When no new tier or status are given, then nothing is stored', async () => {
      await setupAccountUseCase.updatePreCreatedUserForCheckout(
        preCreatedUser.uuid,
        {},
      );

      expect(preCreatedUsersRepository.updateByUuid).toHaveBeenCalledWith(
        preCreatedUser.uuid,
        {},
      );
    });

    test('When no new storage is given, then the storage in the network is left untouched', async () => {
      await setupAccountUseCase.updatePreCreatedUserForCheckout(
        preCreatedUser.uuid,
        { newTierId: preCreatedUser.tierId },
      );

      expect(bridgeService.setStorage).not.toHaveBeenCalled();
    });

    test('When a new storage is given, then it is applied to the network user', async () => {
      const newStorageSpaceBytes = 3298534883328;

      await setupAccountUseCase.updatePreCreatedUserForCheckout(
        preCreatedUser.uuid,
        { newTierId: preCreatedUser.tierId, newStorageSpaceBytes },
      );

      expect(bridgeService.setStorage).toHaveBeenCalledWith(
        preCreatedUser.username,
        newStorageSpaceBytes,
      );
    });
  });
});
