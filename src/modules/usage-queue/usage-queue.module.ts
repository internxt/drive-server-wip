import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsageQueueProcessor } from './usage-queue.processor';
import { UsageEventHandler } from './handlers/usage-event.handler';
import { FileModule } from '../file/file.module';
import { BackupModule } from '../backups/backup.module';
import { CacheManagerModule } from '../cache-manager/cache-manager.module';
import { USAGE_QUEUE_NAME } from './usage-queue.constants';
export { USAGE_QUEUE_NAME } from './usage-queue.constants';

function parseRedisUrl(url: string): {
  host: string;
  port: number;
  password?: string;
  db?: number;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
    ...(parsed.password && { password: decodeURIComponent(parsed.password) }),
    ...(parsed.pathname &&
      parsed.pathname.length > 1 && {
        db: parseInt(parsed.pathname.slice(1), 10),
      }),
  };
}

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: parseRedisUrl(
          configService.get('cache.bullRedisConnectionString'),
        ),
      }),
    }),
    BullModule.registerQueue({
      name: USAGE_QUEUE_NAME,
      defaultJobOptions: {
        removeOnComplete: { age: 60 },
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
