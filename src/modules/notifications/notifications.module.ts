import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import {
  NotificationRepository,
  SequelizeNotificationRepository,
} from './notifications.repository';
import { NotificationsUseCases } from './notifications.usecase';
import { NotificationsController } from './notifications.controller';
import { NotificationModel } from './models/notification.model';
import { UserNotificationStatusModel } from './models/user-notification-status.model';
import { UserModule } from '../user/user.module';
import { NotificationsGuard } from './notifications.guard';

@Module({
  imports: [
    SequelizeModule.forFeature([
      NotificationModel,
      UserNotificationStatusModel,
    ]),
    UserModule,
  ],
  controllers: [NotificationsController],
  providers: [
    {
      provide: NotificationRepository,
      useClass: SequelizeNotificationRepository,
    },
    NotificationsUseCases,
    NotificationsGuard,
  ],
  exports: [NotificationsUseCases],
})
export class NotificationsModule {}
