import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { UsageQueueProcessor } from './usage-queue.processor';
import { UsageEventHandler } from './handlers/usage-event.handler';
import { FileModule } from '../file/file.module';
import { BackupModule } from '../backups/backup.module';
import { CacheManagerModule } from '../cache-manager/cache-manager.module';
import { USAGE_QUEUE_NAME } from './usage-queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = new URL(
          configService.get<string>('cache.redisJobsConnection'),
        );
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port) || 6379,
            password: url.password || undefined,
            username: url.username || undefined,
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
            tls: {},
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: USAGE_QUEUE_NAME,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: { age: 3600 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    }),
    FileModule,
    BackupModule,
    CacheManagerModule,
  ],
  providers: [UsageQueueProcessor, UsageEventHandler],
  exports: [BullModule],
})
export class UsageQueueModule {}
