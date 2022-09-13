import { BadRequestException, Injectable } from '@nestjs/common';
import geoip from 'geoip-lite';
@Injectable()
export class GeolocationService {
  async getLocation(ip: string) {
    const location = await geoip.lookup(ip);
    if (!location) {
      throw new BadRequestException('no location available');
    }
    return location;
  }
}
