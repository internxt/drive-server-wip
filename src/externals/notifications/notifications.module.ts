import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ConfigModule } from '@nestjs/config';
import { NotificationListener } from './listeners/notification.listener';
import { HttpClientModule } from '../http/http.module';
import { MailerModule } from '../mailer/mailer.module';
import { SendLinkListener } from './listeners/send-link.listener';
import { AuthListener } from './listeners/auth.listener';
import { NewsletterService } from '../newsletter';
import { StorageNotificationService } from './storage.notifications.service';
import { ApnModule } from '../apn/apn.module';
import {
  SequelizeUserRepository,
  UserModel,
} from '../../modules/user/user.repository';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserNotificationTokensModel } from '../../modules/user/user-notification-tokens.model';

@Module({
  imports: [
    ConfigModule,
    HttpClientModule,
    MailerModule,
    SequelizeModule.forFeature([UserModel, UserNotificationTokensModel]),
    ApnModule,
  ],
  controllers: [],
  providers: [
    NotificationService,
    NotificationListener,
    StorageNotificationService,
    SendLinkListener,
    AuthListener,
    NewsletterService,
    SequelizeUserRepository,
  ],
  exports: [NotificationService, StorageNotificationService],
})
export class NotificationModule {}
