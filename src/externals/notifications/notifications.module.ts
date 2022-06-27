import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ConfigModule } from '@nestjs/config';
import { NotificationListener } from './listeners/notification.listener';
import { HttpClientModule } from '../http/http.module';
import { AnalyticsListener } from './listeners/analytics.listener';
@Module({
  imports: [ConfigModule, HttpClientModule],
  controllers: [],
  providers: [NotificationService, NotificationListener, AnalyticsListener],
  exports: [NotificationService],
})
export class NotificationModule {}
