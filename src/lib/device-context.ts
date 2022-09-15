import DeviceDetector from 'device-detector-js';
import { Logger } from '@nestjs/common';
const logger = new Logger();

export function getDeviceContextByUserAgent(userAgent: string) {
  try {
    const deviceDetector = new DeviceDetector();
    const deviceDetected = deviceDetector.parse(userAgent);
    return {
      os: deviceDetected.os,
      device: deviceDetected.device,
      client: deviceDetected.client,
    };
  } catch (err) {
    logger.error(err);
    return {};
  }
}
