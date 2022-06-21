import { Logger } from '@nestjs/common';
import { Request } from 'express';
import geoip from 'geoip-lite';
import DeviceDetector from 'node-device-detector';

const deviceDetector = new DeviceDetector();

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
    const location = await this.getLocation(ipaddress).catch((err) =>
      this.logger.error(err),
    );

    const campaign = this.getUTM(this.req.headers.referrer);

    const app = {
      name: this.req.headers['internxt-client'],
      version: this.req.headers['internxt-version'],
    };
    const userAgent = this.req.headers['user-agent'];
    const deviceContext = this.getDeviceContext(userAgent);

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

  getDeviceContext(userAgent: string) {
    let deviceContext = {};
    try {
      if (userAgent) {
        const deviceDetected = deviceDetector.detect(userAgent);
        const os = {
          version: deviceDetected.os.version,
          name: deviceDetected.os.name,
          short_name: deviceDetected.os.short_name,
          family: deviceDetected.os.family,
        };
        const device = {
          type: deviceDetected.device.type,
          manufacturer: deviceDetected.device.brand,
          model: deviceDetected.device.model,
          brand: deviceDetected.device.brand,
          brand_id: deviceDetected.device.id,
        };
        const client = deviceDetected.client;

        deviceContext = {
          os,
          device,
          client,
        };
      }
    } catch (err) {
      this.logger.error(err);
    }

    return deviceContext;
  }
  async getLocation(ipaddress: string): Promise<Location> {
    let location: Location = null;
    try {
      location = await geoip.lookup(ipaddress);
      if (!location) {
        throw Error('No location available');
      }
    } catch (err) {
      throw new Error(err.message || 'No message');
    }
    return {
      country: location.country,
      region: location.region,
      city: location.city,
      timezone: location.timezone,
    };
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
      UTMS.map((utm) => {
        if (searchParams.has(utm)) {
          campaign[utm] = searchParams.get(utm);
        }
      });
    }
    return campaign;
  }
}
