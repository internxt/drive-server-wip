import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { NotificationModel } from './models/notification.model';
import { Notification } from './domain/notification.domain';
import { UserNotificationStatus } from './domain/user-notification-status.domain';
import { UserNotificationStatusModel } from './models/user-notification-status.model';

export abstract class NotificationRepository {
  abstract toDomain(model: NotificationModel): Notification;
  abstract userNotificationStatusToDomain(
    model: UserNotificationStatusModel,
  ): UserNotificationStatus;
}

@Injectable()
export class SequelizeNotificationRepository extends NotificationRepository {
  constructor(
    @InjectModel(NotificationModel)
    private readonly notificationModel: typeof NotificationModel,
    @InjectModel(UserNotificationStatusModel)
    private readonly userNotificationStatusModel: typeof UserNotificationStatusModel,
  ) {
    super();
  }

  toDomain(model: NotificationModel): Notification {
    return Notification.build({
      id: model.id,
      link: model.link,
      message: model.message,
      targetType: model.targetType,
      targetValue: model.targetValue,
      expiresAt: model.expiresAt,
      isActive: model.isActive,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    });
  }

  userNotificationStatusToDomain(
    model: UserNotificationStatusModel,
  ): UserNotificationStatus {
    return UserNotificationStatus.build({
      id: model.id,
      userId: model.userId,
      notificationId: model.notificationId,
      deliveredAt: model.deliveredAt,
      readAt: model.readAt,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    });
  }
}
