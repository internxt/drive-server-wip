import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { NotificationModel } from './models/notification.model';
import { UserNotificationStatusModel } from './models/user-notification-status.model';

export abstract class NotificationRepository {}

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
}
