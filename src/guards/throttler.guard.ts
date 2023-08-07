import { ThrottlerGuard as DefaultThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ThrottlerGuard extends DefaultThrottlerGuard {
  protected getTracker(req: Record<string, any>): string {
    console.log('x-forwarded-for', req.headers['x-forwarded-for']);
    return req.headers['x-forwarded-for']
      ? req.headers['x-forwarded-for']
      : req.ip;
  }
}
