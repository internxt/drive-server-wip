import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheManagerService } from '../modules/cache-manager/cache-manager.service';
import { Observable } from 'rxjs';
import { ThrottlerException } from '@nestjs/throttler';
import { User } from 'src/modules/user/user.domain';
import { Reflector } from '@nestjs/core';
import { CUSTOM_ENDPOINT_THROTTLE_KEY } from './custom-endpoint-throttle.decorator';

@Injectable()
export class CustomThrottlerInterceptor implements NestInterceptor {
  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheManagerService,
    private readonly reflector: Reflector,
  ) {}

  private getRateLimit(user?: User): { ttl: number; limit: number } {
    if (!user) {
      return {
        ttl: this.configService.get<number>('users.rateLimit.anonymous.ttl'),
        limit: this.configService.get<number>(
          'users.rateLimit.anonymous.limit',
        ),
      };
    }
    if (user.tierId === this.configService.get<string>('users.freeTierId')) {
      return {
        ttl: this.configService.get<number>('users.rateLimit.free.ttl'),
        limit: this.configService.get<number>('users.rateLimit.free.limit'),
      };
    }
    return {
      ttl: this.configService.get<number>('users.rateLimit.paid.ttl'),
      limit: this.configService.get<number>('users.rateLimit.paid.limit'),
    };
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Interceptors run before guards, so we must check metadata and
    // bypass the global interceptor when custom throttle is present.
    const hasCustom =
      this.reflector.get(CUSTOM_ENDPOINT_THROTTLE_KEY, context.getHandler()) ||
      this.reflector.get(CUSTOM_ENDPOINT_THROTTLE_KEY, context.getClass());

    if (hasCustom) {
      return next.handle();
    }
    const user = request.user as User | null;
    let key = `rl:${request.ip}`;
    if (user && user.uuid) {
      key = `rl:${user.uuid}`;
    }

    const { ttl, limit } = this.getRateLimit(user);

    const record = await this.cacheService.increment(key, ttl);

    if (ttl && limit) {
      const remaining = Math.max(0, limit - record.totalHits);
      const resetTime = record.timeToExpire;

      response.setHeader('x-internxt-ratelimit-limit', limit);
      response.setHeader('x-internxt-ratelimit-remaining', remaining);
      response.setHeader('x-internxt-ratelimit-reset', resetTime);
    }

    if (record.totalHits > limit) {
      throw new ThrottlerException();
    }

    return next.handle();
  }
}
