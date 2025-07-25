import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ConfigModule } from '@nestjs/config';
import { NotificationListener } from './listeners/notification.listener';
import { HttpClientModule } from '../http/http.module';
import { MailerModule } from '../mailer/mailer.module';
import { SendLinkListener } from './listeners/send-link.listener';
import { AnalyticsListener } from './listeners/analytics.listener';
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
import { AuditLogModel } from '../../modules/user/audit-logs.model';
import { SequelizeAuditLogRepository } from '../../modules/user/audit-logs.repository';
import { AuditLogListener } from './listeners/audit-log.listener';
import { AuditLogService } from './audit-log.service';

@Module({
  imports: [
    ConfigModule,
    HttpClientModule,
    MailerModule,
    SequelizeModule.forFeature([
      UserModel,
      UserNotificationTokensModel,
      AuditLogModel,
    ]),
    ApnModule,
  ],
  controllers: [],
  providers: [
    NotificationService,
    NotificationListener,
    StorageNotificationService,
    AnalyticsListener,
    SendLinkListener,
    AuthListener,
    AuditLogListener,
    NewsletterService,
    SequelizeUserRepository,
    SequelizeAuditLogRepository,
    AuditLogService,
  ],
  exports: [NotificationService, StorageNotificationService, AuditLogService],
})
export class NotificationModule {}
