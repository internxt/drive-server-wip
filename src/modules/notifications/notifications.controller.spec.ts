import { Test, type TestingModule } from '@nestjs/testing';
import { type DeepMocked, createMock } from '@golevelup/ts-jest';

import { NotificationsController } from './notifications.controller';
import { NotificationsUseCases } from './notifications.usecase';
import { type CreateNotificationDto } from './dto/create-notification.dto';
import { newNotification, newUser } from '../../../test/fixtures';
import { NotificationResponseDto } from './dto/response/notification-response.dto';
import { NotificationWithStatusDto } from './dto/response/notification-with-status.dto';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsUseCases: DeepMocked<NotificationsUseCases>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
    })
      .useMocker(() => createMock())
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
    notificationsUseCases = module.get(NotificationsUseCases);
  });

  describe('POST /', () => {
    it('When valid notification data is provided, then it should create notification successfully', async () => {
      const expirationDateString = '2024-12-31T23:59:59Z';
      const mockNotification = newNotification({
        attributes: { expiresAt: new Date(expirationDateString) },
      });
      const notificationDto = new NotificationResponseDto(mockNotification);
      const createNotificationDto: CreateNotificationDto = {
        link: mockNotification.link,
        message: mockNotification.message,
        expiresAt: expirationDateString,
      };

      notificationsUseCases.createNotification.mockResolvedValueOnce(
        mockNotification,
      );

      const result = await controller.createNotification(createNotificationDto);

      expect(notificationsUseCases.createNotification).toHaveBeenCalledWith(
        createNotificationDto,
      );
      expect(result).toEqual(notificationDto);
    });
  });

  describe('GET /', () => {
    it('When user requests notifications, then it should return user notifications with status', async () => {
      const mockUser = newUser();
      const mockNotification = newNotification();
      const mockNotificationWithStatus = {
        notification: mockNotification,
        isRead: false,
        deliveredAt: new Date(),
        readAt: null,
      };
      const expectedDto = new NotificationWithStatusDto(
        mockNotificationWithStatus,
      );

      notificationsUseCases.getNewNotificationsForUser.mockResolvedValueOnce([
        mockNotificationWithStatus,
      ]);

      const result = await controller.getUserNotifications(mockUser);

      expect(
        notificationsUseCases.getNewNotificationsForUser,
      ).toHaveBeenCalledWith(mockUser.uuid);
      expect(result).toEqual([expectedDto]);
    });
  });

  describe('PATCH /:id/expire', () => {
    it('When valid notification id is provided, then it should mark notification as expired', async () => {
      const mockExpiredNotification = newNotification({
        attributes: {
          expiresAt: new Date(),
        },
      });
      const expectedDto = new NotificationResponseDto(mockExpiredNotification);

      notificationsUseCases.markNotificationAsExpired.mockResolvedValueOnce(
        mockExpiredNotification,
      );

      const result = await controller.markNotificationAsExpired(
        mockExpiredNotification.id,
      );

      expect(
        notificationsUseCases.markNotificationAsExpired,
      ).toHaveBeenCalledWith(mockExpiredNotification.id);
      expect(result).toEqual(expectedDto);
    });
  });
});
