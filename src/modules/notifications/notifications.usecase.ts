import { BadRequestException, Injectable } from '@nestjs/common';
import { NotificationRepository } from './notifications.repository';
import {
  Notification,
  NotificationTargetType,
} from './domain/notification.domain';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { v4 } from 'uuid';
import { Time } from '../../lib/time';
import { SequelizeUserRepository } from '../user/user.repository';

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
    const { targetType } = createNotificationDto;
    const isTargetUser = targetType === NotificationTargetType.USER;

    if (isTargetUser) {
      const user = await this.getUserByEmailOrThrow(
        createNotificationDto.targetValue,
      );
      targetValue = user.uuid;
    }

    const notification = Notification.build({
      id: v4(),
      link: createNotificationDto.link,
      message: createNotificationDto.message,
      targetType: createNotificationDto.targetType,
      targetValue: targetValue,
      expiresAt: createNotificationDto.expiresAt
        ? Time.now(createNotificationDto.expiresAt)
        : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.notificationRepository.create(notification);
  }

  private async getUserByEmailOrThrow(email: string) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new BadRequestException(`User ${email} not found`);
    }
    return user;
  }
}
