import { Test, TestingModule } from '@nestjs/testing';
import { DeepMocked, createMock } from '@golevelup/ts-jest';

import { NotificationsController } from './notifications.controller';
import { NotificationsUseCases } from './notifications.usecase';
import { CreateNotificationDto } from './dto/create-notification.dto';
import {} from './domain/notification.domain';
import { newNotification } from '../../../test/fixtures';
import { NotificationResponseDto } from './dto/notification-response.dto';

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
});
