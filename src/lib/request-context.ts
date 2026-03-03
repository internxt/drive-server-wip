import { Logger } from '@nestjs/common';
import { type Request } from 'express';
import { getDeviceContextByUserAgent } from './device-context';
import { getLocation } from './location';

export interface Location {
  country: string;
  region: string;
  city: string;
  timezone: string;
}

export class RequestContext {
  req: Request;
  logger: Logger;
  constructor(req: Request) {
    this.req = req;
    this.logger = new Logger();
  }

  async getContext() {
    const ipaddress =
      this.req.header('x-forwarded-for') || this.req.socket.remoteAddress || '';
    const location = await getLocation(ipaddress).catch((err) =>
      this.logger.error(err),
    );

    const campaign = this.getUTM(this.req.headers.referrer);

    const app = {
      name: this.req.headers['internxt-client'],
      version: this.req.headers['internxt-version'],
    };
    const userAgent = this.req.headers['user-agent'];
    const deviceContext = getDeviceContextByUserAgent(userAgent);

    const context = {
      app,
      campaign,
      ip: ipaddress,
      location,
      userAgent,
      locale: { language: this.req.headers['accept-language'] },
      ...deviceContext,
    };

    return context;
  }

  getUTM(referrer: any) {
    const campaign = Object.create({});
    if (typeof referrer === 'string') {
      const { searchParams } = new URL(referrer);
      const UTMS = [
        'utm_name',
        'utm_source',
        'utm_medium',
        'utm_content',
        'utm_id',
      ];
      UTMS.forEach((utm) => {
        if (searchParams.has(utm)) {
          campaign[utm] = searchParams.get(utm);
        }
      });
    }
    return campaign;
  }
}
