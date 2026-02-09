import { Injectable } from '@nestjs/common';
import { ThrottlerGuard as BaseThrottlerGuard } from '@nestjs/throttler';
import jwt from 'jsonwebtoken'

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

  protected async getTracker(req: any): Promise<string> {
    let userId = req.user?.uuid;

    if (!userId) {
      userId = this.decodeAuthIfPresent(req);
    }

    if (userId) {
      return `rl:${userId}`;
    }

    const ip = await super.getTracker(req);
    return `rl:${ip}`;
  }
}
