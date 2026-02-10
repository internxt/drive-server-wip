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
import { getClientIp, setRateLimitHeaders } from './throttler-utils';

const THROTTLER_LIMIT_KEY = 'THROTTLER:LIMIT';
const THROTTLER_NAMES = ['default', 'short', 'long'];

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

    // Bypass tier-based throttling when the route has an explicit @Throttle() override
    const hasThrottleOverride = THROTTLER_NAMES.some((name) =>
      this.reflector.getAllAndOverride(THROTTLER_LIMIT_KEY + name, [
        context.getHandler(),
        context.getClass(),
      ]),
    );

    if (hasThrottleOverride) {
      return next.handle();
    }

    const user = request.user as User | null;
    const ip = getClientIp(request);
    let key = `rl:${ip}`;
    if (user?.uuid) {
      key = `rl:${user.uuid}`;
    }

    const { ttl, limit } = this.getRateLimit(user);

    const record = await this.cacheService.increment(key, ttl * 1000);

    if (ttl && limit) {
      setRateLimitHeaders(
        response,
        limit,
        record.totalHits,
        record.timeToExpire,
      );
    }

    if (record.totalHits > limit) {
      throw new ThrottlerException();
    }

    return next.handle();
  }
}
