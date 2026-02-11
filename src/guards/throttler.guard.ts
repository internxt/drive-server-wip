import { Injectable } from '@nestjs/common';
import { ThrottlerGuard as BaseThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerRequest } from '@nestjs/throttler/dist/throttler.guard.interface';
import {
  decodeUserUuidFromAuth,
  getClientIp,
  setRateLimitHeaders,
} from './throttler-utils';

const THROTTLER_LIMIT_KEY = 'THROTTLER:LIMIT';

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

    const handler = context.getHandler();
    const classRef = context.getClass();
    const routeLimit = this.reflector.getAllAndOverride<number>(
      THROTTLER_LIMIT_KEY + throttler.name,
      [handler, classRef],
    );
    if (routeLimit === undefined) {
      return true;
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

    setRateLimitHeaders(res, limit, totalHits, timeToExpire);

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
