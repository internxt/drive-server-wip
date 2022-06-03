import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { NotificationListener } from './listeners/notification.listener';
@Module({
  imports: [ConfigModule, HttpModule],
  controllers: [],
  providers: [NotificationService, NotificationListener],
  exports: [NotificationService],
})
export class NotificationModule {}
