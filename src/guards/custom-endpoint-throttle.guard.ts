import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException } from '@nestjs/throttler';
import jwt from 'jsonwebtoken';
import { CacheManagerService } from '../modules/cache-manager/cache-manager.service';
import {
  CUSTOM_ENDPOINT_THROTTLE_KEY,
  CustomThrottleOptions,
} from './custom-endpoint-throttle.decorator';

@Injectable()
export class CustomEndpointThrottleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheManagerService,
  ) {}

  private decodeAuthIfPresent(request: any): string | null {
    if (!request.headers.authorization) {
      return null;
    }
    try {
      const token = request.headers.authorization.split(' ')[1];
      const decoded: any = jwt.decode(token);
      return decoded?.uuid || decoded?.payload?.uuid;
    } catch {
      return null; 
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const raw = this.reflector.get<any>(
      CUSTOM_ENDPOINT_THROTTLE_KEY,
      context.getHandler(),
    );

    // If no custom throttle metadata, do not block (this guard should be applied
    // only where needed). Returning true lets other guards run.
    if (!raw) return true;

    const policies: Array<CustomThrottleOptions & { key?: string }> = [];

    if (
      typeof raw === 'object' &&
      (raw as any).ttl === undefined &&
      (raw as any).limit === undefined
    ) {
      // named policies object: { short: { ttl, limit }, long: { ttl, limit } }
      const entries = Object.entries(raw) as [string, CustomThrottleOptions][];
      for (const [name, val] of entries) {
        policies.push({ ...(val as CustomThrottleOptions), key: name });
      }
    } else {
      policies.push({
        ...(raw as CustomThrottleOptions),
        key: (raw as any).key ?? 'policy0',
      });
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    let ip = request.headers['cf-connecting-ip'];
    if (Array.isArray(ip)) {
      ip = ip[0];
    }
    if (!ip) {
      ip = request.ip;
    }

    const userId = request.user?.uuid || this.decodeAuthIfPresent(request);

    const identifierBase = userId
      ? `cet:uid:${user.uuid}`
      : `cet:ip:${ip}`;
    const route = request.route?.path ?? request.originalUrl ?? 'unknown';

    // Apply all policies. If any policy is violated, throw.
    for (let i = 0; i < policies.length; i++) {
      const p = policies[i];
      // Prefer an explicit stable key from the policy so the identity
      // remains the same even if the array order changes. Fallback to
      // index-based id when no key provided.
      const policyId = p.key ? String(p.key) : `policy${i}`;
      const sanitizedRoute = String(route).replace(/\s+/g, '_');
      const sanitizedPolicyId = policyId.replace(/\s+/g, '_');
      const key = `${sanitizedRoute}:${sanitizedPolicyId}:${identifierBase}`;
      const record = await this.cacheService.increment(key, p.ttl);
      if (record.totalHits > p.limit) {
        throw new ThrottlerException();
      }
    }

    return true;
  }
}
