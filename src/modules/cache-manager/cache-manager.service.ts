import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheManagerService {
  private readonly USAGE_KEY_PREFIX = 'usage:';
  private readonly LIMIT_KEY_PREFIX = 'user:limit:';

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get user's storage usage
   */
  async getUserUsage(userUuid: string) {
    const cachedUsage = this.cacheManager.get<{ usage: number }>(
      `${this.USAGE_KEY_PREFIX}${userUuid}`,
    );

    return cachedUsage;
  }

  /**
   * Set user's storage usage
   */
  async setUserUsage(userUuid: string, usage: number) {
    const cachedUsage = await this.cacheManager.set(
      `${this.USAGE_KEY_PREFIX}${userUuid}`,
      { usage },
      10000 * 60,
    );

    return cachedUsage;
  }
}
