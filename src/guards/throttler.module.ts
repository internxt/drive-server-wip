import { ConfigModule, ConfigService } from "@nestjs/config";
import { seconds, ThrottlerModule } from "@nestjs/throttler";
import { CacheManagerService } from "../modules/cache-manager/cache-manager.service";
import { Module } from "@nestjs/common";
import { CustomThrottlerInterceptor } from "./throttler.interceptor";
import { CacheManagerModule } from "../modules/cache-manager/cache-manager.module";

@Module({
  imports: [
    CacheManagerModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule, CacheManagerModule],
      inject: [CacheManagerService, ConfigService],
      useFactory: (
        customStorage: CacheManagerService,
        configService: ConfigService,
      ) => ({
        storage: customStorage,
        throttlers: [
          {
            ttl: seconds(configService.get('users.rateLimit.default.ttl')),
            limit: configService.get('users.rateLimit.default.limit')
          },
        ],
      }),
    }),
  ],
  providers: [
    CustomThrottlerInterceptor,
  ],
  exports: [
    CustomThrottlerInterceptor,
  ],
})
export class CustomThrottlerModule {}