import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { CacheManagerService } from '../modules/cache-manager/cache-manager.service';
import { Module } from '@nestjs/common';
import { CustomThrottlerInterceptor } from './throttler.interceptor';
import { CacheManagerModule } from '../modules/cache-manager/cache-manager.module';

@Module({
  imports: [
    CacheManagerModule,
    ThrottlerModule.forRootAsync({
      imports: [CacheManagerModule],
      inject: [CacheManagerService],
      useFactory: (customStorage: CacheManagerService) => ({
        storage: customStorage,
        throttlers: [
          { name: 'short', ttl: seconds(60), limit: 999999 },
          { name: 'long', ttl: seconds(3600), limit: 999999 },
        ],
      }),
    }),
  ],
  providers: [CustomThrottlerInterceptor],
  exports: [CustomThrottlerInterceptor],
})
export class CustomThrottlerModule {}
