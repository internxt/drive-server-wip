import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { NotificationModel } from './models/notification.model';
import { UserNotificationStatusModel } from './models/user-notification-status.model';
import {
  Notification,
  NotificationTargetType,
} from './domain/notification.domain';
import {
  UserNotificationStatus,
  type UserNotificationStatusAttributes,
} from './domain/user-notification-status.domain';
import { Op } from 'sequelize';

export interface NotificationWithStatus {
  notification: Notification;
  status?: UserNotificationStatus;
}

export abstract class NotificationRepository {
  abstract create(
    notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Notification>;

  abstract getNewNotificationsForUser(
    userId: string,
  ): Promise<NotificationWithStatus[]>;

  abstract createManyUserNotificationStatuses(
    userNotificationStatuses: UserNotificationStatusAttributes[],
  ): Promise<UserNotificationStatus[]>;

  abstract update(
    id: string,
    updates: Partial<Pick<Notification, 'expiresAt' | 'updatedAt'>>,
  ): Promise<Notification>;
  abstract findById(id: string): Promise<Notification>;
}

@Injectable()
export class SequelizeNotificationRepository implements NotificationRepository {
  constructor(
    @InjectModel(NotificationModel)
    private readonly notificationModel: typeof NotificationModel,
    @InjectModel(UserNotificationStatusModel)
    private readonly userNotificationStatusModel: typeof UserNotificationStatusModel,
  ) {}

  async create(notification: Omit<Notification, 'id'>): Promise<Notification> {
    const created = await this.notificationModel.create({
      ...notification,
    });

    return this.toDomain(created);
  }

  async getNewNotificationsForUser(
    userId: string,
  ): Promise<NotificationWithStatus[]> {
    const notifications = await this.notificationModel.findAll({
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
              { expiresAt: { [Op.gt]: new Date() } },
            ],
          },
          {
            '$userNotificationStatuses.id$': null,
          },
        ],
      },
      include: [
        {
          model: this.userNotificationStatusModel,
          where: {
            userId,
          },
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return notifications.map((notificationModel) => {
      const notification = this.toDomain(notificationModel);
      const statusModel = notificationModel.userNotificationStatuses?.[0];
      const status = statusModel
        ? this.userNotificationStatusToDomain(statusModel)
        : undefined;

      return {
        notification,
        status,
      };
    });
  }

  async findById(id: string): Promise<Notification> {
    const notification = await this.notificationModel.findOne({
      where: { id },
    });

    return notification ? this.toDomain(notification) : null;
  }
  async update(
    id: string,
    updates: Partial<Pick<Notification, 'expiresAt' | 'updatedAt'>>,
  ): Promise<Notification> {
    const [_, updated] = await this.notificationModel.update(updates, {
      where: { id },
      returning: true,
    });

    return updated.length > 0 ? this.toDomain(updated[0]) : null;
  }

  async createManyUserNotificationStatuses(
    notificationStatuses: UserNotificationStatusAttributes[],
  ): Promise<UserNotificationStatus[]> {
    if (notificationStatuses.length === 0) {
      return [];
    }

    const created =
      await this.userNotificationStatusModel.bulkCreate(notificationStatuses);

    return created.map((statusModel) =>
      this.userNotificationStatusToDomain(statusModel),
    );
  }

  toDomain(model: NotificationModel): Notification {
    return Notification.build({ ...model.get() });
  }

  private userNotificationStatusToDomain(
    model: UserNotificationStatusModel,
  ): UserNotificationStatus {
    return UserNotificationStatus.build({ ...model.get() });
  }
}
