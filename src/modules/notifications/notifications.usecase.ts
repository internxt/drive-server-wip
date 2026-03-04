import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationRepository } from './notifications.repository';
import {
  Notification,
  NotificationTargetType,
  type NotificationWithStatus,
} from './domain/notification.domain';
import { type CreateNotificationDto } from './dto/create-notification.dto';
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

    const expirationTime = createNotificationDto.expiresAt
      ? Time.now(createNotificationDto.expiresAt)
      : Time.dateWithTimeAdded(10, 'day', Time.now());

    const notification = Notification.build({
      id: v4(),
      link: createNotificationDto.link,
      message: createNotificationDto.message,
      targetType: targetType,
      targetValue: targetValue,
      expiresAt: expirationTime,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.notificationRepository.create(notification);
  }

  async getNewNotificationsForUser(
    userId: string,
  ): Promise<NotificationWithStatus[]> {
    const userNotifications =
      await this.notificationRepository.getNewNotificationsForUser(userId);

    const notificationsWithoutStatus = userNotifications.filter(
      ({ status }) => !status,
    );

    const currentTime = Time.now();

    if (notificationsWithoutStatus.length > 0) {
      const userNotificationStatuses = notificationsWithoutStatus.map(
        ({ notification }) =>
          UserNotificationStatus.build({
            id: v4(),
            userId,
            notificationId: notification.id,
            deliveredAt: currentTime,
            // Let notifications to be fetched only once
            readAt: currentTime,
            createdAt: currentTime,
            updatedAt: currentTime,
          }),
      );

      await this.notificationRepository.createManyUserNotificationStatuses(
        userNotificationStatuses,
      );
    }

    return userNotifications.map(({ notification, status }) => {
      return {
        notification,
        isRead: true,
        deliveredAt: status?.deliveredAt ?? currentTime,
        readAt: status?.readAt ?? currentTime,
      };
    });
  }

  async markNotificationAsExpired(
    notificationId: string,
  ): Promise<Notification> {
    const notification =
      await this.notificationRepository.findById(notificationId);

    if (!notification) {
      throw new NotFoundException(
        `Notification with id ${notificationId} not found`,
      );
    }

    const currentTime = Time.now();
    const updatedNotification = await this.notificationRepository.update(
      notificationId,
      {
        expiresAt: currentTime,
        updatedAt: currentTime,
      },
    );

    return updatedNotification;
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
