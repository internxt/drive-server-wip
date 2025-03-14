import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { Logger } from '@nestjs/common';
import { StorageNotificationService } from './storage.notifications.service';
import { NotificationService } from './notification.service';
import { ApnService } from '../apn/apn.service';
import { SequelizeUserRepository } from '../../modules/user/user.repository';
import { NotificationEvent } from './events/notification.event';
import { newUser } from '../../../test/fixtures';
import { UserNotificationTokens } from '../../modules/user/user-notification-tokens.domain';
import { v4 } from 'uuid';

describe('StorageNotificationService', () => {
  let service: StorageNotificationService;
  let notificationService: NotificationService;
  let apnService: ApnService;
  let userRepository: SequelizeUserRepository;
  let loggerMock: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageNotificationService],
    })
      .useMocker(createMock)
      .compile();

    loggerMock = createMock<Logger>();
    module.useLogger(loggerMock);

    service = module.get<StorageNotificationService>(
      StorageNotificationService,
    );
    notificationService = module.get<NotificationService>(NotificationService);
    apnService = module.get<ApnService>(ApnService);
    userRepository = module.get<SequelizeUserRepository>(
      SequelizeUserRepository,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('planUpdated', () => {
    const user = newUser();
    const payload = { maxSpaceBytes: 1000000 };
    const clientId = 'test-client';

    it('When called, then it should add a notification event and send APN notification with custom options', () => {
      const notification = new NotificationEvent(
        'notification.planUpdated',
        payload,
        user.email,
        clientId,
        user.uuid,
        'PLAN_UPDATED',
      );
      jest.spyOn(service, 'getTokensAndSendApnNotification');

      service.planUpdated({ payload, user, clientId });

      expect(notificationService.add).toHaveBeenCalledWith(notification);
      expect(service.getTokensAndSendApnNotification).toHaveBeenCalledWith(
        user.uuid,
        {
          isStorageNotification: false,
          customKeys: { event: 'PLAN_UPDATED' },
        },
      );
    });
  });

  describe('getTokensAndSendApnNotification', () => {
    const user = newUser();

    const tokens = [
      new UserNotificationTokens({
        id: v4(),
        token: 'token',
        type: 'macos',
        userId: user.uuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      new UserNotificationTokens({
        id: v4(),
        token: 'token2',
        type: 'macos',
        userId: user.uuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      new UserNotificationTokens({
        id: v4(),
        token: 'token3',
        type: 'macos',
        userId: user.uuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ];

    it('When called with valid tokens, then it should send notifications to all tokens', async () => {
      jest
        .spyOn(userRepository, 'getNotificationTokens')
        .mockResolvedValue(tokens);
      jest
        .spyOn(apnService, 'sendNotification')
        .mockResolvedValue({ statusCode: 200, body: '' });

      await service.getTokensAndSendApnNotification(user.uuid);

      expect(userRepository.getNotificationTokens).toHaveBeenCalledWith(
        user.uuid,
        { type: 'macos' },
      );
      expect(apnService.sendNotification).toHaveBeenCalledTimes(3);
      tokens.forEach(({ token }) => {
        expect(apnService.sendNotification).toHaveBeenCalledWith(
          token,
          {},
          user.uuid,
          true,
          null,
        );
      });
      expect(
        userRepository.deleteUserNotificationTokens,
      ).not.toHaveBeenCalled();
    });

    it('When some tokens are expired, then it should delete them', async () => {
      jest
        .spyOn(userRepository, 'getNotificationTokens')
        .mockResolvedValue(tokens);
      jest
        .spyOn(apnService, 'sendNotification')
        .mockResolvedValueOnce({ statusCode: 200, body: '' })
        .mockResolvedValueOnce({ statusCode: 410, body: '' }) // expired token
        .mockResolvedValueOnce({ statusCode: 200, body: '' });

      await service.getTokensAndSendApnNotification(user.uuid);

      expect(userRepository.deleteUserNotificationTokens).toHaveBeenCalledWith(
        user.uuid,
        ['token2'],
      );
    });

    it('When sending notification fails, then it should log error and continue', async () => {
      jest
        .spyOn(userRepository, 'getNotificationTokens')
        .mockResolvedValue(tokens);
      const error = new Error('APN error');
      jest
        .spyOn(apnService, 'sendNotification')
        .mockResolvedValueOnce({ statusCode: 200, body: '' })
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ statusCode: 200, body: '' });

      const errorSpy = jest.spyOn(loggerMock, 'error');

      await service.getTokensAndSendApnNotification(user.uuid);

      expect(errorSpy).toHaveBeenCalled();
      expect(apnService.sendNotification).toHaveBeenCalledTimes(3);
    });

    it('When called with custom options, then it should pass them properly', async () => {
      jest
        .spyOn(userRepository, 'getNotificationTokens')
        .mockResolvedValue([{ token: 'token1' }] as any);
      jest
        .spyOn(apnService, 'sendNotification')
        .mockResolvedValue({ statusCode: 200, body: '' });

      const options = {
        isStorageNotification: false,
        customKeys: { event: 'CUSTOM_EVENT' },
      };

      await service.getTokensAndSendApnNotification(user.uuid, options);

      expect(apnService.sendNotification).toHaveBeenCalledWith(
        'token1',
        {},
        user.uuid,
        options.isStorageNotification,
        options.customKeys,
      );
    });
  });
});
