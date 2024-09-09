import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ConfigModule } from '@nestjs/config';
import { NotificationListener } from './listeners/notification.listener';
import { HttpClientModule } from '../http/http.module';
import { MailerModule } from '../mailer/mailer.module';
import { SendLinkListener } from './listeners/send-link.listener';
import { AnalyticsListener } from './listeners/analytics.listener';
import { ShareLinkListener } from './listeners/share-link.listener';
import { AuthListener } from './listeners/auth.listener';
import { NewsletterService } from '../newsletter';
import { StorageNotificationService } from './storage.notifications.service';
@Module({
  imports: [ConfigModule, HttpClientModule, MailerModule],
  controllers: [],
  providers: [
    NotificationService,
    NotificationListener,
    StorageNotificationService,
    AnalyticsListener,
    SendLinkListener,
    ShareLinkListener,
    AuthListener,
    NewsletterService,
  ],
  exports: [NotificationService, StorageNotificationService],
})
export class NotificationModule {}
