import { Injectable } from '@nestjs/common';
import { ThrottlerGuard as BaseThrottlerGuard } from '@nestjs/throttler';
@Injectable()
export class ThrottlerGuard extends BaseThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const trackedIp = req.ips.length ? req.ips[0] : req.ip;
    // setting app.set('trust proxy', true); makes Express check x-forwarded-for header
    return trackedIp;
  }
}

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: any): Promise<string> {
    const userId = req.user?.uuid;
    return userId ? `rl:${userId}` : `rl:${req.ip}`;
  }
}