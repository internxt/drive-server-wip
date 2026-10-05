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
import { newPreCreatedUser, newTier, newUser } from '../../../test/fixtures';
import { PreCreatedUserStatus } from './pre-created-users.attributes';
import { SequelizePreCreatedUsersRepository } from './pre-created-users.repository';
import { SetupCheckoutAccountUseCase } from './setup-account.usecase';
import { SequelizeUserRepository } from './user.repository';
import { UserUseCases } from './user.usecase';
import { type PreCreatedUser } from './pre-created-user.domain';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { PreCreatedUserNotFoundException } from './exception/pre-created-user-not-found.exception';
import { SequelizeSharingRepository } from '../sharing/sharing.repository';
import { SequelizeWorkspaceRepository } from '../workspaces/repositories/workspaces.repository';

jest.mock('../../middlewares/passport', () => ({
  __esModule: true,
  ...jest.requireActual('../../middlewares/passport'),
  signWithExpiry: jest.fn(() => 'newToken'),
}));

describe('Setup account use cases', () => {
  let setupAccountUseCase: SetupCheckoutAccountUseCase;
  let userRepository: DeepMocked<SequelizeUserRepository>;
  let preCreatedUsersRepository: DeepMocked<SequelizePreCreatedUsersRepository>;
  let bridgeService: DeepMocked<BridgeService>;
  let mailerService: DeepMocked<MailerService>;
  let userUseCases: DeepMocked<UserUseCases>;
  let featureLimitService: DeepMocked<FeatureLimitService>;
  let sharingRepository: DeepMocked<SequelizeSharingRepository>;
  let workspaceRepository: DeepMocked<SequelizeWorkspaceRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SetupCheckoutAccountUseCase],
    })
      .useMocker(createMock)
      .compile();

    setupAccountUseCase = moduleRef.get(SetupCheckoutAccountUseCase);
    userRepository = moduleRef.get(SequelizeUserRepository);
    preCreatedUsersRepository = moduleRef.get(
      SequelizePreCreatedUsersRepository,
    );
    bridgeService = moduleRef.get(BridgeService);
    mailerService = moduleRef.get(MailerService);
    userUseCases = moduleRef.get(UserUseCases);
    featureLimitService = moduleRef.get(FeatureLimitService);
    sharingRepository = moduleRef.get(SequelizeSharingRepository);
    workspaceRepository = moduleRef.get(SequelizeWorkspaceRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Pre-creating the user of a new customer at checkout', () => {
    const networkUuid = v4();
    const email = 'buyer@internxt.com';

    const preCreatedUserResult = {
      id: 1,
      email,
      uuid: networkUuid,
      username: email,
      publicKyberKey: 'public-kyber-key',
      publicKey: 'public-key',
      password: '',
      status: PreCreatedUserStatus.AwaitingPayment,
    };

    beforeEach(() => {
      userRepository.findByUsername.mockResolvedValue(null);
      preCreatedUsersRepository.findByUsername.mockResolvedValue(null);
      bridgeService.createUser.mockResolvedValue({
        userId: 'network-user',
        uuid: networkUuid,
      });
      userUseCases.preCreateUser.mockResolvedValue([
        preCreatedUserResult,
        true,
      ]);
    });

    test('When the email is new, then the user is pre-created with the network user uuid, awaiting the payment', async () => {
      const result =
        await setupAccountUseCase.getOrCreate('Buyer@Internxt.com');

      expect(result).toEqual({
        uuid: networkUuid,
        status: PreCreatedUserStatus.AwaitingPayment,
      });
      expect(bridgeService.createUser).toHaveBeenCalledWith(email);
      expect(userUseCases.preCreateUser).toHaveBeenCalledWith(
        { email },
        networkUuid,
        PreCreatedUserStatus.AwaitingPayment,
      );
    });

    test('When the user is pre-created, then no setup email is sent', async () => {
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
      expect(userUseCases.preCreateUser).not.toHaveBeenCalled();
    });

    test.each([
      PreCreatedUserStatus.AwaitingPayment,
      PreCreatedUserStatus.PendingSetup,
    ])(
      'When the email is already pre-created for a checkout and its status is %s, then it is returned as it is without touching the network',
      async (status) => {
        const preCreatedUser = newPreCreatedUser();
        preCreatedUser.status = status;
        preCreatedUsersRepository.findByUsername.mockResolvedValue(
          preCreatedUser,
        );

        const result = await setupAccountUseCase.getOrCreate(email);

        expect(result).toEqual({ uuid: preCreatedUser.uuid, status });
        expect(bridgeService.createUser).not.toHaveBeenCalled();
        expect(userUseCases.preCreateUser).not.toHaveBeenCalled();
        expect(preCreatedUsersRepository.updateByUuid).not.toHaveBeenCalled();
        expect(
          sharingRepository.updateAllUserSharedWith,
        ).not.toHaveBeenCalled();
      },
    );

    test('When the user cancelled the plan and buys again, then the checkout starts again awaiting the payment', async () => {
      const cancelledUser = newPreCreatedUser();
      cancelledUser.uuid = networkUuid;
      cancelledUser.status = PreCreatedUserStatus.Cancelled;
      preCreatedUsersRepository.findByUsername.mockResolvedValue(cancelledUser);

      const result = await setupAccountUseCase.getOrCreate(email);

      expect(result).toEqual({
        uuid: networkUuid,
        status: PreCreatedUserStatus.AwaitingPayment,
      });
      expect(userUseCases.preCreateUser).not.toHaveBeenCalled();
      expect(sharingRepository.updateAllUserSharedWith).not.toHaveBeenCalled();
      expect(preCreatedUsersRepository.updateByUuid).toHaveBeenCalledWith(
        networkUuid,
        { status: PreCreatedUserStatus.AwaitingPayment },
      );
    });

    describe('When two requests with the same email arrive at once', () => {
      test('Then the one that loses the creation gets the user the other one created', async () => {
        const createdByTheOther = newPreCreatedUser();
        createdByTheOther.uuid = networkUuid;
        createdByTheOther.status = PreCreatedUserStatus.AwaitingPayment;
        userUseCases.preCreateUser.mockRejectedValueOnce(
          new UniqueConstraintError({}),
        );
        preCreatedUsersRepository.findByUsername
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdByTheOther);

        const result = await setupAccountUseCase.getOrCreate(email);

        expect(result).toEqual({
          uuid: networkUuid,
          status: PreCreatedUserStatus.AwaitingPayment,
        });
      });

      test('When the duplicated user cannot be found afterwards, then the original error is thrown', async () => {
        const duplicatedError = new UniqueConstraintError({});
        userUseCases.preCreateUser.mockRejectedValueOnce(duplicatedError);

        await expect(setupAccountUseCase.getOrCreate(email)).rejects.toThrow(
          duplicatedError,
        );
      });
    });

    test('When the user cannot be pre-created for any other reason, then the error is not hidden', async () => {
      userUseCases.preCreateUser.mockRejectedValueOnce(
        new Error('database error'),
      );

      await expect(setupAccountUseCase.getOrCreate(email)).rejects.toThrow(
        'database error',
      );
    });

    describe('When the email was pre-created by a share invitation', () => {
      const invitationUuid = v4();
      let invitedUser: PreCreatedUser;

      beforeEach(() => {
        invitedUser = newPreCreatedUser();
        invitedUser.uuid = invitationUuid;
        invitedUser.status = null;
        preCreatedUsersRepository.findByUsername.mockResolvedValue(invitedUser);
      });

      test('Then the checkout starts with the network user uuid, awaiting the payment, without creating another pre-created user', async () => {
        const result = await setupAccountUseCase.getOrCreate(email);

        expect(result).toEqual({
          uuid: networkUuid,
          status: PreCreatedUserStatus.AwaitingPayment,
        });
        expect(bridgeService.createUser).toHaveBeenCalledWith(email);
        expect(userUseCases.preCreateUser).not.toHaveBeenCalled();
        expect(preCreatedUsersRepository.updateByUuid).toHaveBeenCalledWith(
          networkUuid,
          { status: PreCreatedUserStatus.AwaitingPayment },
        );
      });

      test('Then the shared items and workspace invitations follow the user to the network user uuid', async () => {
        await setupAccountUseCase.getOrCreate(email);

        expect(sharingRepository.updateAllUserSharedWith).toHaveBeenCalledWith(
          invitationUuid,
          { sharedWith: networkUuid },
        );
        expect(workspaceRepository.updateInvitesBy).toHaveBeenCalledWith(
          { invitedUser: invitationUuid },
          { invitedUser: networkUuid },
        );
        expect(preCreatedUsersRepository.updateByUuid).toHaveBeenCalledWith(
          invitationUuid,
          { uuid: networkUuid },
        );
      });

      test('Then the own uuid of the pre-created user is replaced last, so a retry after a failure repeats the pending steps', async () => {
        workspaceRepository.updateInvitesBy.mockRejectedValueOnce(
          new Error('database error'),
        );

        await expect(setupAccountUseCase.getOrCreate(email)).rejects.toThrow(
          'database error',
        );

        expect(preCreatedUsersRepository.updateByUuid).not.toHaveBeenCalledWith(
          invitationUuid,
          { uuid: networkUuid },
        );
        expect(preCreatedUsersRepository.updateByUuid).not.toHaveBeenCalledWith(
          networkUuid,
          expect.anything(),
        );
      });

      test('When it already has the network user uuid, then nothing is reassigned and only the status is updated', async () => {
        invitedUser.uuid = networkUuid;

        await setupAccountUseCase.getOrCreate(email);

        expect(
          sharingRepository.updateAllUserSharedWith,
        ).not.toHaveBeenCalled();
        expect(workspaceRepository.updateInvitesBy).not.toHaveBeenCalled();
        expect(preCreatedUsersRepository.updateByUuid).toHaveBeenCalledTimes(1);
        expect(preCreatedUsersRepository.updateByUuid).toHaveBeenCalledWith(
          networkUuid,
          { status: PreCreatedUserStatus.AwaitingPayment },
        );
      });
    });
  });

  describe('Getting a pre-created user by email', () => {
    const email = 'buyer@internxt.com';

    test.each([
      { status: PreCreatedUserStatus.PendingSetup },
      { status: PreCreatedUserStatus.AwaitingPayment },
    ])(
      'When the user is pre-created and its status is $status, then its uuid and status are returned',
      async ({ status }) => {
        const preCreatedUser = newPreCreatedUser();
        preCreatedUser.status = status;
        preCreatedUsersRepository.findByUsername.mockResolvedValue(
          preCreatedUser,
        );

        const result = await setupAccountUseCase.get(email);

        expect(result).toEqual({ uuid: preCreatedUser.uuid, status });
      },
    );

    test('When the email has uppercase letters, then the user is looked up by the lowercase email', async () => {
      preCreatedUsersRepository.findByUsername.mockResolvedValue(
        newPreCreatedUser(),
      );

      await setupAccountUseCase.get('Buyer@Internxt.COM');

      expect(preCreatedUsersRepository.findByUsername).toHaveBeenCalledWith(
        email,
      );
    });

    test('When the email is not pre-created, then it is reported as not found with the code the gateway clients recognize', async () => {
      preCreatedUsersRepository.findByUsername.mockResolvedValue(null);

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
      preCreatedUsersRepository.findByUsername.mockResolvedValue(null);

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
    let preCreatedUser: PreCreatedUser;

    beforeEach(() => {
      process.env.HOST_DRIVE_WEB = hostDriveWeb;
      preCreatedUser = newPreCreatedUser();
      preCreatedUser.setupEmailSentAt = null;
      preCreatedUser.status = PreCreatedUserStatus.AwaitingPayment;
      preCreatedUsersRepository.findByUuid.mockResolvedValue(preCreatedUser);
      preCreatedUsersRepository.updateByUuidAndStatus.mockResolvedValue(true);
    });

    test('When the pre-created user is awaiting the payment, then the email is sent with the plan name and a single-purpose link that expires in 5 days', async () => {
      await setupAccountUseCase.sendAccountEmail(preCreatedUser.uuid, planName);

      expect(mailerService.sendAccountSetupEmail).toHaveBeenCalledWith(
        preCreatedUser.email,
        { planName, setupUrl: `${hostDriveWeb}/complete-account/newToken` },
      );
      expect(signWithExpiry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            uuid: preCreatedUser.uuid,
            action: 'complete-account-setup',
          },
        }),
        getEnv().secrets.jwt,
        { expiresIn: '5d' },
      );
    });

    test('When the email is sent, then the moment it was sent is stored and matches the link token', async () => {
      await setupAccountUseCase.sendAccountEmail(preCreatedUser.uuid, planName);

      const [[, , { setupEmailSentAt }]] = jest.mocked(
        preCreatedUsersRepository.updateByUuidAndStatus,
      ).mock.calls as unknown as [
        [string, unknown, { setupEmailSentAt: Date }],
      ];
      const [[{ iat }]] = jest.mocked(signWithExpiry).mock.calls as unknown as [
        [{ iat: number }],
      ];
      expect(
        preCreatedUsersRepository.updateByUuidAndStatus,
      ).toHaveBeenCalledWith(
        preCreatedUser.uuid,
        PreCreatedUserStatus.AwaitingPayment,
        {
          setupEmailSentAt: expect.any(Date),
          status: PreCreatedUserStatus.PendingSetup,
        },
      );
      expect(iat).toBe(Math.floor(setupEmailSentAt.getTime() / 1000));
    });

    test('When the same payment is notified twice at once and another request already took it, then the email is not sent again', async () => {
      preCreatedUsersRepository.updateByUuidAndStatus.mockResolvedValue(false);

      await setupAccountUseCase.sendAccountEmail(preCreatedUser.uuid, planName);

      expect(mailerService.sendAccountSetupEmail).not.toHaveBeenCalled();
      expect(preCreatedUsersRepository.updateByUuid).not.toHaveBeenCalled();
    });

    test('When the email cannot be sent, then it is released so a retry sends it', async () => {
      preCreatedUser.setupEmailSentAt = new Date('2026-09-20T10:00:00Z');
      mailerService.sendAccountSetupEmail.mockRejectedValueOnce(
        new Error('SendGrid is down'),
      );

      await expect(
        setupAccountUseCase.sendAccountEmail(preCreatedUser.uuid, planName),
      ).rejects.toThrow('SendGrid is down');

      expect(preCreatedUsersRepository.updateByUuid).toHaveBeenCalledWith(
        preCreatedUser.uuid,
        {
          status: PreCreatedUserStatus.AwaitingPayment,
          setupEmailSentAt: new Date('2026-09-20T10:00:00Z'),
        },
      );
    });

    test('When the email cannot be sent and releasing it also fails, then the sending error is the one reported', async () => {
      const sendError = new Error('SendGrid is down');
      mailerService.sendAccountSetupEmail.mockRejectedValueOnce(sendError);
      preCreatedUsersRepository.updateByUuid.mockRejectedValueOnce(
        new Error('database error'),
      );

      await expect(
        setupAccountUseCase.sendAccountEmail(preCreatedUser.uuid, planName),
      ).rejects.toThrow(sendError);
    });

    test('When the plan name is unknown, then the email is still sent without it', async () => {
      await setupAccountUseCase.sendAccountEmail(preCreatedUser.uuid);

      expect(mailerService.sendAccountSetupEmail).toHaveBeenCalledWith(
        preCreatedUser.email,
        {
          planName: undefined,
          setupUrl: `${hostDriveWeb}/complete-account/newToken`,
        },
      );
    });

    test('When the email was already sent, then it is not sent again', async () => {
      preCreatedUser.setupEmailSentAt = new Date('2026-09-20T10:00:00Z');
      preCreatedUser.status = PreCreatedUserStatus.PendingSetup;

      await setupAccountUseCase.sendAccountEmail(preCreatedUser.uuid, planName);

      expect(mailerService.sendAccountSetupEmail).not.toHaveBeenCalled();
      expect(
        preCreatedUsersRepository.updateByUuidAndStatus,
      ).not.toHaveBeenCalled();
    });

    test.each([PreCreatedUserStatus.Cancelled, null])(
      'When the status of the pre-created user is %s, then no email is sent because there is no confirmed payment',
      async (status) => {
        preCreatedUser.status = status;

        await setupAccountUseCase.sendAccountEmail(
          preCreatedUser.uuid,
          planName,
        );

        expect(mailerService.sendAccountSetupEmail).not.toHaveBeenCalled();
        expect(
          preCreatedUsersRepository.updateByUuidAndStatus,
        ).not.toHaveBeenCalled();
      },
    );

    test('When the uuid belongs to a registered user, then nothing is sent', async () => {
      const registeredUser = newUser();
      preCreatedUsersRepository.findByUuid.mockResolvedValue(null);
      userRepository.findByUuid.mockResolvedValue(registeredUser);

      await setupAccountUseCase.sendAccountEmail(registeredUser.uuid, planName);

      expect(mailerService.sendAccountSetupEmail).not.toHaveBeenCalled();
    });

    test('When the uuid belongs to no user, then it is reported as not found', async () => {
      preCreatedUsersRepository.findByUuid.mockResolvedValue(null);
      userRepository.findByUuid.mockResolvedValue(null);

      await expect(
        setupAccountUseCase.sendAccountEmail(v4(), planName),
      ).rejects.toThrow(NotFoundException);

      expect(mailerService.sendAccountSetupEmail).not.toHaveBeenCalled();
    });
  });

  describe('Updating the pre-created user of a customer at checkout', () => {
    let preCreatedUser: PreCreatedUser;

    beforeEach(() => {
      preCreatedUser = newPreCreatedUser();
      preCreatedUsersRepository.findByUuid.mockResolvedValue(preCreatedUser);
      featureLimitService.getTier.mockResolvedValue(
        newTier({ id: preCreatedUser.tierId }),
      );
    });

    test('When the pre-created user does not exist, then it is reported as not found', async () => {
      preCreatedUsersRepository.findByUuid.mockResolvedValue(null);

      await expect(
        setupAccountUseCase.update(v4(), {
          newTierId: v4(),
        }),
      ).rejects.toThrow(NotFoundException);

      expect(preCreatedUsersRepository.updateByUuid).not.toHaveBeenCalled();
      expect(bridgeService.setStorage).not.toHaveBeenCalled();
    });

    test('When the tier does not exist, then it is rejected as a bad request', async () => {
      featureLimitService.getTier.mockResolvedValue(null);
      const newTierId = v4();

      await expect(
        setupAccountUseCase.update(preCreatedUser.uuid, { newTierId }),
      ).rejects.toThrow(BadRequestException);

      expect(featureLimitService.getTier).toHaveBeenCalledWith(newTierId);
      expect(preCreatedUsersRepository.updateByUuid).not.toHaveBeenCalled();
      expect(bridgeService.setStorage).not.toHaveBeenCalled();
    });

    test('When a new tier and status are given, then both are stored', async () => {
      const newTierId = v4();
      featureLimitService.getTier.mockResolvedValue(newTier({ id: newTierId }));

      await setupAccountUseCase.update(preCreatedUser.uuid, {
        newTierId,
        status: PreCreatedUserStatus.Cancelled,
      });

      expect(preCreatedUsersRepository.updateByUuid).toHaveBeenCalledWith(
        preCreatedUser.uuid,
        { tierId: newTierId, status: PreCreatedUserStatus.Cancelled },
      );
    });

    test('When no new tier or status are given, then nothing is stored', async () => {
      await setupAccountUseCase.update(preCreatedUser.uuid, {});

      expect(preCreatedUsersRepository.updateByUuid).toHaveBeenCalledWith(
        preCreatedUser.uuid,
        {},
      );
    });

    test('When no new storage is given, then the storage in the network is left untouched', async () => {
      await setupAccountUseCase.update(preCreatedUser.uuid, {
        newTierId: preCreatedUser.tierId,
      });

      expect(bridgeService.setStorage).not.toHaveBeenCalled();
    });

    test('When a new storage is given, then it is applied to the network user', async () => {
      const newStorageSpaceBytes = 3298534883328;

      await setupAccountUseCase.update(preCreatedUser.uuid, {
        newTierId: preCreatedUser.tierId,
        newStorageSpaceBytes,
      });

      expect(bridgeService.setStorage).toHaveBeenCalledWith(
        preCreatedUser.username,
        newStorageSpaceBytes,
      );
    });
  });
});
