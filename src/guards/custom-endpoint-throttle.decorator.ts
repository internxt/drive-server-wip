import { SetMetadata } from '@nestjs/common';

export const CUSTOM_ENDPOINT_THROTTLE_KEY = 'customEndpointThrottle';

export interface CustomThrottleOptions {
  ttl: number; // seconds
  limit: number;
}

/**
 * You can use two different shapes:
 * - single policy: { ttl, limit }
 * - named policies: { short: { ttl, limit }, long: { ttl, limit } }
 */
type CustomThrottleArg =
  | CustomThrottleOptions
  | Record<string, CustomThrottleOptions>;

export const CustomThrottle = (opts: CustomThrottleArg) =>
  SetMetadata(CUSTOM_ENDPOINT_THROTTLE_KEY, opts);
