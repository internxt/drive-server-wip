import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { NotificationModel } from './models/notification.model';
import { UserNotificationStatusModel } from './models/user-notification-status.model';
import { Notification } from './domain/notification.domain';

export abstract class NotificationRepository {
  abstract create(
    notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Notification>;
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

  async create(notification: Omit<Notification, 'id'>): Promise<Notification> {
    const created = await this.notificationModel.create({
      ...notification,
    });

    return this.toDomain(created);
  }

  toDomain(model: NotificationModel) {
    return Notification.build({ ...model });
  }
}
