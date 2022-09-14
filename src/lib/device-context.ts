import DeviceDetector from 'node-device-detector';
import { Logger } from '@nestjs/common';
const logger = new Logger();

export function getDeviceContextByUserAgent(userAgent: string) {
  try {
    const deviceDetector = new DeviceDetector();
    const deviceDetected = deviceDetector.detect(userAgent);
    return {
      os: {
        version: deviceDetected.os.version,
        name: deviceDetected.os.name,
        short_name: deviceDetected.os.short_name,
        family: deviceDetected.os.family,
      },
      device: {
        type: deviceDetected.device.type,
        manufacturer: deviceDetected.device.brand,
        model: deviceDetected.device.model,
        brand: deviceDetected.device.brand,
        brand_id: deviceDetected.device.id,
      },
      client: deviceDetected.client,
    };
  } catch (err) {
    logger.error(err);
    return {};
  }
}
