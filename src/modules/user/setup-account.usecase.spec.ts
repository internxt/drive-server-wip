import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UniqueConstraintError } from 'sequelize';
import { v4 } from 'uuid';
import { signWithExpiry } from '../../middlewares/passport';
import getEnv from '../../config/configuration';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { MailerService } from '../../externals/mailer/mailer.service';
import {
  newPreCreatedUserCheckout,
  newTier,
  newUser,
} from '../../../test/fixtures';
import { PreCreatedUserStatus } from './pre-created-users.attributes';
import { type PreCreatedUserCheckout } from './pre-created-user-checkout.domain';
import { SequelizePreCreatedUserCheckoutRepository } from './pre-created-user-checkout.repository';
import { SetupCheckoutAccountUseCase } from './setup-account.usecase';
import { SequelizeUserRepository } from './user.repository';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { PreCreatedUserNotFoundException } from './exception/pre-created-user-not-found.exception';

jest.mock('../../middlewares/passport', () => ({
  __esModule: true,
  ...jest.requireActual('../../middlewares/passport'),
  signWithExpiry: jest.fn(() => 'newToken'),
}));

describe('Setup account use cases', () => {
  let setupAccountUseCase: SetupCheckoutAccountUseCase;
  let userRepository: DeepMocked<SequelizeUserRepository>;
  let preCreatedUserCheckoutRepository: DeepMocked<SequelizePreCreatedUserCheckoutRepository>;
  let bridgeService: DeepMocked<BridgeService>;
  let mailerService: DeepMocked<MailerService>;
  let featureLimitService: DeepMocked<FeatureLimitService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SetupCheckoutAccountUseCase],
    })
      .useMocker(createMock)
      .compile();

    setupAccountUseCase = moduleRef.get(SetupCheckoutAccountUseCase);
    userRepository = moduleRef.get(SequelizeUserRepository);
    preCreatedUserCheckoutRepository = moduleRef.get(
      SequelizePreCreatedUserCheckoutRepository,
    );
    bridgeService = moduleRef.get(BridgeService);
    mailerService = moduleRef.get(MailerService);
    featureLimitService = moduleRef.get(FeatureLimitService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Starting the checkout of a new customer', () => {
    const networkUuid = v4();
    const email = 'buyer@internxt.com';

    beforeEach(() => {
      userRepository.findByUsername.mockResolvedValue(null);
      preCreatedUserCheckoutRepository.findByEmail.mockResolvedValue(null);
      bridgeService.createUser.mockResolvedValue({
        userId: 'network-user',
        uuid: networkUuid,
      });
      preCreatedUserCheckoutRepository.create.mockImplementation(
        async (attributes) => newPreCreatedUserCheckout(attributes),
      );
    });

    test('When the email is new, then the checkout starts with the network user uuid, awaiting the payment', async () => {
      const result =
        await setupAccountUseCase.getOrCreate('Buyer@Internxt.com');

      expect(result).toEqual({
        uuid: networkUuid,
        status: PreCreatedUserStatus.AwaitingPayment,
      });
      expect(bridgeService.createUser).toHaveBeenCalledWith(email);
      expect(preCreatedUserCheckoutRepository.create).toHaveBeenCalledWith({
        networkUuid,
        email,
        status: PreCreatedUserStatus.AwaitingPayment,
      });
    });

    test('When the checkout starts, then no setup email is sent', async () => {
      await setupAccountUseCase.getOrCreate(email);

      expect(mailerService.sendAccountSetupEmail).not.toHaveBeenCalled();
    });

    test('When the email belongs to a registered user, then it is rejected as a conflict without touching the network', async () => {
      userRepository.findByUsername.mockResolvedValue(
        newUser({ attributes: { email } }),
      );

      await expect(setupAccountUseCase.getOrCreate(email)).rejects.toThrow(
        ConflictException,
      );

      expect(bridgeService.createUser).not.toHaveBeenCalled();
      expect(preCreatedUserCheckoutRepository.create).not.toHaveBeenCalled();
    });

    test.each([
      PreCreatedUserStatus.AwaitingPayment,
      PreCreatedUserStatus.PendingSetup,
    ])(
      'When the checkout already started and its status is %s, then it is returned as it is without touching the network',
      async (status) => {
        const checkout = newPreCreatedUserCheckout({ email, status });
        preCreatedUserCheckoutRepository.findByEmail.mockResolvedValue(
          checkout,
        );

        const result = await setupAccountUseCase.getOrCreate(email);

        expect(result).toEqual({ uuid: checkout.networkUuid, status });
        expect(bridgeService.createUser).not.toHaveBeenCalled();
        expect(preCreatedUserCheckoutRepository.create).not.toHaveBeenCalled();
        expect(
          preCreatedUserCheckoutRepository.updateByNetworkUuid,
        ).not.toHaveBeenCalled();
      },
    );

    test('When the customer cancelled the plan and buys again, then the checkout starts again awaiting the payment without the tier left by the cancellation', async () => {
      const cancelledCheckout = newPreCreatedUserCheckout({
        networkUuid,
        email,
        status: PreCreatedUserStatus.Cancelled,
        tierId: v4(),
      });
      preCreatedUserCheckoutRepository.findByEmail.mockResolvedValue(
        cancelledCheckout,
      );

      const result = await setupAccountUseCase.getOrCreate(email);

      expect(result).toEqual({
        uuid: networkUuid,
        status: PreCreatedUserStatus.AwaitingPayment,
      });
      expect(preCreatedUserCheckoutRepository.create).not.toHaveBeenCalled();
      expect(
        preCreatedUserCheckoutRepository.updateByNetworkUuid,
      ).toHaveBeenCalledWith(networkUuid, {
        networkUuid,
        status: PreCreatedUserStatus.AwaitingPayment,
        tierId: null,
      });
    });

    describe('When two requests with the same email arrive at once', () => {
      test('Then the one that loses the creation gets the checkout the other one created', async () => {
        const createdByTheOther = newPreCreatedUserCheckout({
          networkUuid,
          email,
        });
        preCreatedUserCheckoutRepository.create.mockRejectedValueOnce(
          new UniqueConstraintError({}),
        );
        preCreatedUserCheckoutRepository.findByEmail
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdByTheOther);

        const result = await setupAccountUseCase.getOrCreate(email);

        expect(result).toEqual({
          uuid: networkUuid,
          status: PreCreatedUserStatus.AwaitingPayment,
        });
      });

      test('When the duplicated checkout cannot be found afterwards, then the original error is thrown', async () => {
        const duplicatedError = new UniqueConstraintError({});
        preCreatedUserCheckoutRepository.create.mockRejectedValueOnce(
          duplicatedError,
        );

        await expect(setupAccountUseCase.getOrCreate(email)).rejects.toThrow(
          duplicatedError,
        );
      });
    });

    test('When the checkout cannot be stored for any other reason, then the error is not hidden', async () => {
      preCreatedUserCheckoutRepository.create.mockRejectedValueOnce(
        new Error('database error'),
      );

      await expect(setupAccountUseCase.getOrCreate(email)).rejects.toThrow(
        'database error',
      );
    });
  });

  describe('Getting a checkout by email', () => {
    const email = 'buyer@internxt.com';

    test.each([
      { status: PreCreatedUserStatus.PendingSetup },
      { status: PreCreatedUserStatus.AwaitingPayment },
    ])(
      'When the checkout exists and its status is $status, then its uuid and status are returned',
      async ({ status }) => {
        const checkout = newPreCreatedUserCheckout();
        checkout.status = status;
        preCreatedUserCheckoutRepository.findByEmail.mockResolvedValue(
          checkout,
        );

        const result = await setupAccountUseCase.get(email);

        expect(result).toEqual({ uuid: checkout.networkUuid, status });
      },
    );

    test('When the email has uppercase letters, then the checkout is looked up by the lowercase email', async () => {
      preCreatedUserCheckoutRepository.findByEmail.mockResolvedValue(
        newPreCreatedUserCheckout(),
      );

      await setupAccountUseCase.get('Buyer@Internxt.COM');

      expect(preCreatedUserCheckoutRepository.findByEmail).toHaveBeenCalledWith(
        email,
      );
    });

    test('When the email has no checkout, then it is reported as not found with the code the gateway clients recognize', async () => {
      preCreatedUserCheckoutRepository.findByEmail.mockResolvedValue(null);

      const error = await setupAccountUseCase.get(email).catch((e) => e);

      expect(error).toBeInstanceOf(PreCreatedUserNotFoundException);
      expect(error.getStatus()).toBe(404);
      expect(error.getResponse()).toEqual({
        message: 'Pre-created user not found',
        code: 'USER_NOT_FOUND',
      });
    });

    test('When the email only belongs to a registered user, then it is reported as not found without consulting the registered users', async () => {
      userRepository.findByUsername.mockResolvedValue(
        newUser({ attributes: { email } }),
      );
      preCreatedUserCheckoutRepository.findByEmail.mockResolvedValue(null);

      await expect(setupAccountUseCase.get(email)).rejects.toThrow(
        NotFoundException,
      );

      expect(userRepository.findByUsername).not.toHaveBeenCalled();
      expect(userRepository.findByEmail).not.toHaveBeenCalled();
    });
  });

  describe('Sending the account setup email after the payment', () => {
    const planName = 'Premium 2TB';
    const hostDriveWeb = 'https://drive.internxt.com';
    let checkout: PreCreatedUserCheckout;

    beforeEach(() => {
      process.env.HOST_DRIVE_WEB = hostDriveWeb;
      checkout = newPreCreatedUserCheckout();
      checkout.setupEmailSentAt = null;
      checkout.status = PreCreatedUserStatus.AwaitingPayment;
      preCreatedUserCheckoutRepository.findByNetworkUuid.mockResolvedValue(
        checkout,
      );
      preCreatedUserCheckoutRepository.updateByNetworkUuidAndStatus.mockResolvedValue(
        true,
      );
    });

    test('When the checkout is awaiting the payment, then the email is sent with the plan name and a single-purpose link that expires in 5 days', async () => {
      await setupAccountUseCase.sendAccountEmail(
        checkout.networkUuid,
        planName,
      );

      expect(mailerService.sendAccountSetupEmail).toHaveBeenCalledWith(
        checkout.email,
        { planName, setupUrl: `${hostDriveWeb}/complete-account/newToken` },
      );
      expect(signWithExpiry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            uuid: checkout.networkUuid,
            action: 'complete-account-setup',
          },
        }),
        getEnv().secrets.jwt,
        { expiresIn: '5d' },
      );
    });

    test('When the email is sent, then the moment it was sent is stored and matches the link token', async () => {
      await setupAccountUseCase.sendAccountEmail(
        checkout.networkUuid,
        planName,
      );

      const [[, , { setupEmailSentAt }]] = jest.mocked(
        preCreatedUserCheckoutRepository.updateByNetworkUuidAndStatus,
      ).mock.calls as unknown as [
        [string, unknown, { setupEmailSentAt: Date }],
      ];
      const [[{ iat }]] = jest.mocked(signWithExpiry).mock.calls as unknown as [
        [{ iat: number }],
      ];
      expect(
        preCreatedUserCheckoutRepository.updateByNetworkUuidAndStatus,
      ).toHaveBeenCalledWith(
        checkout.networkUuid,
        PreCreatedUserStatus.AwaitingPayment,
        expect.objectContaining({
          setupEmailSentAt: expect.any(Date),
          status: PreCreatedUserStatus.PendingSetup,
        }),
      );
      expect(iat).toBe(Math.floor(setupEmailSentAt.getTime() / 1000));
    });

    test('When the buyer pays again on the same day after a cancelled purchase, then the resends of the previous purchase do not count towards the daily limit', async () => {
      checkout.setupEmailSentAt = new Date();
      checkout.setupEmailResendCount = 5;

      await setupAccountUseCase.sendAccountEmail(
        checkout.networkUuid,
        planName,
      );

      expect(
        preCreatedUserCheckoutRepository.updateByNetworkUuidAndStatus,
      ).toHaveBeenCalledWith(
        checkout.networkUuid,
        PreCreatedUserStatus.AwaitingPayment,
        expect.objectContaining({ setupEmailResendCount: 0 }),
      );
    });

    test('When the same payment is notified twice at once and another request already took it, then the email is not sent again', async () => {
      preCreatedUserCheckoutRepository.updateByNetworkUuidAndStatus.mockResolvedValue(
        false,
      );

      await setupAccountUseCase.sendAccountEmail(
        checkout.networkUuid,
        planName,
      );

      expect(mailerService.sendAccountSetupEmail).not.toHaveBeenCalled();
      expect(
        preCreatedUserCheckoutRepository.updateByNetworkUuid,
      ).not.toHaveBeenCalled();
    });

    test('When the email cannot be sent, then it is released so a retry sends it', async () => {
      checkout.setupEmailSentAt = new Date('2026-09-20T10:00:00Z');
      checkout.setupEmailResendCount = 2;
      mailerService.sendAccountSetupEmail.mockRejectedValueOnce(
        new Error('SendGrid is down'),
      );

      await expect(
        setupAccountUseCase.sendAccountEmail(checkout.networkUuid, planName),
      ).rejects.toThrow('SendGrid is down');

      expect(
        preCreatedUserCheckoutRepository.updateByNetworkUuid,
      ).toHaveBeenCalledWith(checkout.networkUuid, {
        status: PreCreatedUserStatus.AwaitingPayment,
        setupEmailSentAt: new Date('2026-09-20T10:00:00Z'),
        setupEmailResendCount: 2,
      });
    });

    test('When the email cannot be sent and releasing it also fails, then the sending error is the one reported', async () => {
      const sendError = new Error('SendGrid is down');
      mailerService.sendAccountSetupEmail.mockRejectedValueOnce(sendError);
      preCreatedUserCheckoutRepository.updateByNetworkUuid.mockRejectedValueOnce(
        new Error('database error'),
      );

      await expect(
        setupAccountUseCase.sendAccountEmail(checkout.networkUuid, planName),
      ).rejects.toThrow(sendError);
    });

    test('When the plan name is unknown, then the email is still sent without it', async () => {
      await setupAccountUseCase.sendAccountEmail(checkout.networkUuid);

      expect(mailerService.sendAccountSetupEmail).toHaveBeenCalledWith(
        checkout.email,
        {
          planName: undefined,
          setupUrl: `${hostDriveWeb}/complete-account/newToken`,
        },
      );
    });

    test('When the email was already sent, then it is not sent again', async () => {
      checkout.setupEmailSentAt = new Date('2026-09-20T10:00:00Z');
      checkout.status = PreCreatedUserStatus.PendingSetup;

      await setupAccountUseCase.sendAccountEmail(
        checkout.networkUuid,
        planName,
      );

      expect(mailerService.sendAccountSetupEmail).not.toHaveBeenCalled();
      expect(
        preCreatedUserCheckoutRepository.updateByNetworkUuidAndStatus,
      ).not.toHaveBeenCalled();
    });

    test.each([PreCreatedUserStatus.Cancelled])(
      'When the status of the checkout is %s, then no email is sent because there is no confirmed payment',
      async (status) => {
        checkout.status = status;

        await setupAccountUseCase.sendAccountEmail(
          checkout.networkUuid,
          planName,
        );

        expect(mailerService.sendAccountSetupEmail).not.toHaveBeenCalled();
        expect(
          preCreatedUserCheckoutRepository.updateByNetworkUuidAndStatus,
        ).not.toHaveBeenCalled();
      },
    );

    test('When the uuid belongs to a registered user, then nothing is sent', async () => {
      const registeredUser = newUser();
      preCreatedUserCheckoutRepository.findByNetworkUuid.mockResolvedValue(
        null,
      );
      userRepository.findByUuid.mockResolvedValue(registeredUser);

      await setupAccountUseCase.sendAccountEmail(registeredUser.uuid, planName);

      expect(mailerService.sendAccountSetupEmail).not.toHaveBeenCalled();
    });

    test('When the uuid belongs to no user, then it is reported as not found', async () => {
      preCreatedUserCheckoutRepository.findByNetworkUuid.mockResolvedValue(
        null,
      );
      userRepository.findByUuid.mockResolvedValue(null);

      await expect(
        setupAccountUseCase.sendAccountEmail(v4(), planName),
      ).rejects.toThrow(NotFoundException);

      expect(mailerService.sendAccountSetupEmail).not.toHaveBeenCalled();
    });
  });

  describe('Updating the checkout of a customer', () => {
    let checkout: PreCreatedUserCheckout;

    beforeEach(() => {
      checkout = newPreCreatedUserCheckout();
      preCreatedUserCheckoutRepository.findByNetworkUuid.mockResolvedValue(
        checkout,
      );
      featureLimitService.getTier.mockResolvedValue(
        newTier({ id: checkout.tierId }),
      );
    });

    test('When the checkout does not exist, then it is reported as not found', async () => {
      preCreatedUserCheckoutRepository.findByNetworkUuid.mockResolvedValue(
        null,
      );

      await expect(
        setupAccountUseCase.update(v4(), {
          newTierId: v4(),
        }),
      ).rejects.toThrow(NotFoundException);

      expect(
        preCreatedUserCheckoutRepository.updateByNetworkUuid,
      ).not.toHaveBeenCalled();
      expect(bridgeService.setStorage).not.toHaveBeenCalled();
    });

    test('When the tier does not exist, then it is rejected as a bad request', async () => {
      featureLimitService.getTier.mockResolvedValue(null);
      const newTierId = v4();

      await expect(
        setupAccountUseCase.update(checkout.networkUuid, { newTierId }),
      ).rejects.toThrow(BadRequestException);

      expect(featureLimitService.getTier).toHaveBeenCalledWith(newTierId);
      expect(
        preCreatedUserCheckoutRepository.updateByNetworkUuid,
      ).not.toHaveBeenCalled();
      expect(bridgeService.setStorage).not.toHaveBeenCalled();
    });

    test('When a new tier and status are given, then both are stored', async () => {
      const newTierId = v4();
      featureLimitService.getTier.mockResolvedValue(newTier({ id: newTierId }));

      await setupAccountUseCase.update(checkout.networkUuid, {
        newTierId,
        status: PreCreatedUserStatus.Cancelled,
      });

      expect(
        preCreatedUserCheckoutRepository.updateByNetworkUuid,
      ).toHaveBeenCalledWith(checkout.networkUuid, {
        tierId: newTierId,
        status: PreCreatedUserStatus.Cancelled,
      });
    });

    test('When no new tier or status are given, then nothing is stored', async () => {
      await setupAccountUseCase.update(checkout.networkUuid, {});

      expect(
        preCreatedUserCheckoutRepository.updateByNetworkUuid,
      ).toHaveBeenCalledWith(checkout.networkUuid, {});
    });

    test('When no new storage is given, then the storage in the network is left untouched', async () => {
      await setupAccountUseCase.update(checkout.networkUuid, {
        newTierId: checkout.tierId,
      });

      expect(bridgeService.setStorage).not.toHaveBeenCalled();
    });

    test('When a new storage is given, then it is applied to the network user', async () => {
      const newStorageSpaceBytes = 3298534883328;

      await setupAccountUseCase.update(checkout.networkUuid, {
        newTierId: checkout.tierId,
        newStorageSpaceBytes,
      });

      expect(bridgeService.setStorage).toHaveBeenCalledWith(
        checkout.email,
        newStorageSpaceBytes,
      );
    });
  });
});
