import { BadRequestException, Injectable } from '@nestjs/common';
import { NotificationRepository } from './notifications.repository';
import {
  Notification,
  NotificationTargetType,
  NotificationWithStatus,
} from './domain/notification.domain';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { v4 } from 'uuid';
import { Time } from '../../lib/time';
import { SequelizeUserRepository } from '../user/user.repository';
import { isEmail } from 'class-validator';
import { UserNotificationStatus } from './domain/user-notification-status.domain';

@Injectable()
export class NotificationsUseCases {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly userRepository: SequelizeUserRepository,
  ) {}

  async createNotification(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    let targetValue = null;
    const { email } = createNotificationDto;

    if (email) {
      const user = await this.getUserByEmailOrThrow(email);
      targetValue = user.uuid;
    }
    const targetType = email
      ? NotificationTargetType.USER
      : NotificationTargetType.ALL;

    const notification = Notification.build({
      id: v4(),
      link: createNotificationDto.link,
      message: createNotificationDto.message,
      targetType: targetType,
      targetValue: targetValue,
      expiresAt: createNotificationDto.expiresAt
        ? Time.now(createNotificationDto.expiresAt)
        : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.notificationRepository.create(notification);
  }

  async getUserNotifications(
    userId: string,
    options: { includeReadNotifications: boolean },
  ): Promise<NotificationWithStatus[]> {
    const { includeReadNotifications } = options;

    const userNotifications =
      await this.notificationRepository.getNotificationsForUser(userId, {
        includeReadNotifications,
      });

    const notificationsWithoutStatus = userNotifications.filter(
      ({ status }) => !status,
    );

    if (notificationsWithoutStatus.length > 0) {
      const now = Time.now();

      const userNotificationStatuses = notificationsWithoutStatus.map(
        ({ notification }) =>
          UserNotificationStatus.build({
            id: v4(),
            userId,
            notificationId: notification.id,
            deliveredAt: now,
            readAt: null,
            createdAt: now,
            updatedAt: now,
          }),
      );

      await this.notificationRepository.createManyUserNotificationStatuses(
        userNotificationStatuses,
      );
    }

    const currentTime = Time.now();
    return userNotifications.map(({ notification, status }) => {
      return {
        notification,
        isRead: status?.isRead() ?? false,
        deliveredAt: status?.deliveredAt ?? currentTime,
        readAt: status?.readAt ?? null,
      };
    });
  }

  private async getUserByEmailOrThrow(email: string) {
    if (!isEmail(email)) {
      throw new BadRequestException(`Value ${email} is not a valid email`);
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new BadRequestException(`User ${email} not found`);
    }
    return user;
  }
}
