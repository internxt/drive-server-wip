import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { NotificationListener } from './listeners/notification.listener';
import { HttpClientModule } from '../http/http.module';
import { MailerModule } from '../mailer/mailer.module';
import { SendLinkListener } from './listeners/send-link.listener';
import { AuthListener } from './listeners/auth.listener';
import { NewsletterService } from '../newsletter';
import {
  APN_REFRESH_QUEUE,
  StorageNotificationService,
} from './storage.notifications.service';
import { ApnModule } from '../apn/apn.module';
import {
  SequelizeUserRepository,
  UserModel,
} from '../../modules/user/user.repository';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserNotificationTokensModel } from '../../modules/user/user-notification-tokens.model';
import { ApnRefreshProcessor } from './apn-refresh.processor';
import { buildBullConnectionOptions } from '../../lib/bull-connection';

@Module({
  imports: [
    ConfigModule,
    HttpClientModule,
    MailerModule,
    SequelizeModule.forFeature([UserModel, UserNotificationTokensModel]),
    ApnModule,
    BullModule.registerQueueAsync({
      name: APN_REFRESH_QUEUE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: buildBullConnectionOptions(configService),
      }),
    }),
  ],
  controllers: [],
  providers: [
    NotificationService,
    NotificationListener,
    StorageNotificationService,
    ApnRefreshProcessor,
    SendLinkListener,
    AuthListener,
    NewsletterService,
    SequelizeUserRepository,
  ],
  exports: [NotificationService, StorageNotificationService],
})
export class NotificationModule {}
