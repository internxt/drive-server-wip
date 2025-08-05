import { ThrottlerGuard as DefaultThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ThrottlerGuard extends DefaultThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const trackedIp = req.ips.length ? req.ips[0] : req.ip;
    // setting app.set('trust proxy', true); makes Express check x-forwarded-for header
    return trackedIp;
  }
}
