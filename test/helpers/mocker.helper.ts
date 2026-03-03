import { Logger } from '@nestjs/common';
import { vi } from 'vitest';

/**
 * Mocks all the methods of a Logger instance.
 * The methods are mocked to do nothing when called.
 * This is useful for testing, to avoid logging output in test results.
 */
export function mockLogger() {
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
}
