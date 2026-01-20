import { Logger, Module } from '@nestjs/common';
import { CacheModule, CacheOptions } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { CacheManagerService } from './cache-manager.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (
        configService: ConfigService,
      ): Promise<CacheOptions> => {
        const logger = new Logger('REDIS_MODULE');
        const redisUrl = configService.get('cache.redisConnectionString');

        const redisStore = createKeyv({
          url: redisUrl,
          // Let client throw instead of create an offline queue
          disableOfflineQueue: true,
          socket: {
            reconnectStrategy: false,
          },
        });

        // Error propagation should be stopped by adding event listener
        redisStore.on('error', (err) =>
          logger.error(
            `Error on redis client: ${err}, url: ${redisUrl}`,
          ),
        );

        return {
          stores: redisStore,
          nonBlocking: true,
        };
      },
    }),
  ],
  providers: [CacheManagerService],
  exports: [CacheManagerService],
})
export class CacheManagerModule {}
