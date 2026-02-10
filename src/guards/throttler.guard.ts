import { Injectable } from '@nestjs/common';
import { ThrottlerGuard as BaseThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerRequest } from '@nestjs/throttler/dist/throttler.guard.interface';
import { decodeUserUuidFromAuth, getClientIp } from './throttler-utils';

const THROTTLER_LIMIT_KEY = 'THROTTLER:LIMIT';
const THROTTLER_NAMES = ['default', 'short', 'long'];

@Injectable()
export class CustomThrottlerGuard extends BaseThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    let userId = req.user?.uuid;

    if (!userId) {
      userId = decodeUserUuidFromAuth(req);
    }

    if (userId) {
      return `rl:${userId}`;
    }

    const ip = getClientIp(req);
    return `rl:${ip}`;
  }

  private hasThrottleOverride(context: any): boolean {
    const handler = context.getHandler();
    const classRef = context.getClass();
    return THROTTLER_NAMES.some(
      (name) =>
        name !== 'default' &&
        this.reflector.getAllAndOverride(THROTTLER_LIMIT_KEY + name, [
          handler,
          classRef,
        ]) !== undefined,
    );
  }

  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const {
      context,
      limit,
      ttl,
      throttler,
      blockDuration,
      getTracker,
      generateKey,
    } = requestProps;

    if (throttler.name === 'default') {
      if (this.hasThrottleOverride(context)) {
        return true;
      }
    } else {
      const handler = context.getHandler();
      const classRef = context.getClass();
      const routeLimit = this.reflector.getAllAndOverride<number>(
        THROTTLER_LIMIT_KEY + throttler.name,
        [handler, classRef],
      );
      if (routeLimit === undefined) {
        return true;
      }
    }

    const { req, res } = this.getRequestResponse(context);
    const tracker = await getTracker(req, context);
    const key = generateKey(context, tracker, throttler.name);

    const { totalHits, timeToExpire, isBlocked, timeToBlockExpire } =
      await this.storageService.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttler.name,
      );

    const remaining = Math.max(0, limit - totalHits);
    const timeToExpireInSeconds = Math.ceil(timeToExpire / 1000);

    res.header('X-RateLimit-Limit', limit);
    res.header('X-RateLimit-Remaining', remaining);
    res.header('X-RateLimit-Reset', timeToExpireInSeconds);
    res.header('x-internxt-ratelimit-limit', limit);
    res.header('x-internxt-ratelimit-remaining', remaining);
    res.header('x-internxt-ratelimit-reset', timeToExpireInSeconds);

    if (isBlocked) {
      res.header('Retry-After', timeToBlockExpire);
      await this.throwThrottlingException(context, {
        limit,
        ttl,
        key,
        tracker,
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      });
    }

    return true;
  }
}
