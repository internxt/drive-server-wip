import { Injectable } from '@nestjs/common';
import { ThrottlerGuard as BaseThrottlerGuard } from '@nestjs/throttler';
@Injectable()
export class ThrottlerGuard extends BaseThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const cfIp = req.headers['cf-connecting-ip'];
    console.log('cfIP', cfIp);

    if (cfIp) {
      return Array.isArray(cfIp) ? cfIp[0] : cfIp;
    }
    return req.ips.length ? req.ips[0] : req.ip;
  }
}

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: any): Promise<string> {
    const userId = req.user?.uuid;

    if (userId) {
      return `rl:${userId}`;
    }

    const ip = await super.getTracker(req);
    return `rl:${ip}`;
  }
}
