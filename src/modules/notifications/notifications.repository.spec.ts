import { createMock } from '@golevelup/ts-jest';
import { Test, type TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { SequelizeNotificationRepository } from './notifications.repository';
import { NotificationModel } from './models/notification.model';
import { UserNotificationStatusModel } from './models/user-notification-status.model';
import {
  newNotification,
  newUserNotificationStatus,
} from '../../../test/fixtures';
import { NotificationTargetType } from './domain/notification.domain';
import { Op } from 'sequelize';
import { v4 } from 'uuid';

describe('SequelizeNotificationRepository', () => {
  let repository: SequelizeNotificationRepository;
  let notificationModel: typeof NotificationModel;
  let userNotificationStatusModel: typeof UserNotificationStatusModel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizeNotificationRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get<SequelizeNotificationRepository>(
      SequelizeNotificationRepository,
    );
    notificationModel = module.get<typeof NotificationModel>(
      getModelToken(NotificationModel),
    );
    userNotificationStatusModel = module.get<
      typeof UserNotificationStatusModel
    >(getModelToken(UserNotificationStatusModel));
  });

  it('When created, then it should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('When creating a notification, then it should call the model create method and return domain object', async () => {
      const notification = newNotification();

      const mockCreatedModel = {
        ...notification,
        get: () => notification,
      } as any;

      jest
        .spyOn(notificationModel, 'create')
        .mockResolvedValueOnce(mockCreatedModel);
      jest.spyOn(repository, 'toDomain').mockReturnValueOnce(notification);

      const result = await repository.create(notification);

      expect(notificationModel.create).toHaveBeenCalledWith(notification);
      expect(repository.toDomain).toHaveBeenCalledWith(mockCreatedModel);
      expect(result).toEqual(notification);
    });
  });

  describe('getNotificationsForUser', () => {
    it('When getting notifications for user, then it should call findAll with correct query parameters', async () => {
      const userId = 'user-uuid';
      const mockNotifications = [];

      jest
        .spyOn(notificationModel, 'findAll')
        .mockResolvedValueOnce(mockNotifications);

      await repository.getNewNotificationsForUser(userId);

      expect(notificationModel.findAll).toHaveBeenCalledWith({
        where: {
          [Op.and]: [
            {
              [Op.or]: [
                { targetType: NotificationTargetType.ALL },
                {
                  targetType: NotificationTargetType.USER,
                  targetValue: userId,
                },
              ],
            },
            {
              [Op.or]: [
                { expiresAt: null },
                { expiresAt: { [Op.gt]: expect.any(Date) } },
              ],
            },
            {
              '$userNotificationStatuses.id$': null,
            },
          ],
        },
        include: [
          {
            model: userNotificationStatusModel,
            where: {
              userId,
            },
            required: false,
          },
        ],
        order: [['createdAt', 'DESC']],
      });
    });
  });

  describe('createManyUserNotificationStatuses', () => {
    it('When creating many user notification statuses, then it should call model with correct data', async () => {
      const userId = v4();
      const notificationStatuses = [
        newUserNotificationStatus({ userId }),
        newUserNotificationStatus({ userId }),
      ];
      const mockCreatedStatuses = [];

      jest
        .spyOn(userNotificationStatusModel, 'bulkCreate')
        .mockResolvedValueOnce(mockCreatedStatuses);

      await repository.createManyUserNotificationStatuses(notificationStatuses);

      expect(userNotificationStatusModel.bulkCreate).toHaveBeenCalledWith(
        notificationStatuses,
      );
    });
  });
});
