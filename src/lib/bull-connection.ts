import { type ConfigService } from '@nestjs/config';
import { type ConnectionOptions } from 'bullmq';

export const buildBullConnectionOptions = (
  configService: ConfigService,
): ConnectionOptions => {
  const connectionString = configService.get<string>(
    'cache.redisJobsConnection',
  );

  if (!connectionString) {
    throw new Error(
      'REDIS_JOBS_CONNECTION_STRING is required to build the BullMQ connection',
    );
  }

  const url = new URL(connectionString);

  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    username: url.username || undefined,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    tls: {},
  };
};
