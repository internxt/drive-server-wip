import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { buildBullConnectionOptions } from '../../lib/bull-connection';
import { APN_REFRESH_QUEUE } from './storage.notifications.service';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: APN_REFRESH_QUEUE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: buildBullConnectionOptions(configService),
      }),
    }),
  ],
  exports: [BullModule],
})
export class ApnRefreshQueueModule {}
