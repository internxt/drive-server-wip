import { ThrottlerGuard as DefaultThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ThrottlerGuard extends DefaultThrottlerGuard {
  protected getTracker(req: Record<string, any>): string {
    const trackedIp = req.ips.length ? req.ips[0] : req.ip;
    console.log('tracked-ip', trackedIp);
    // setting app.set('trust proxy', true); makes Express check x-forwarded-for header
    return trackedIp;
  }
}
