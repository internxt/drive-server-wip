import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheManagerService {
  private readonly USAGE_KEY_PREFIX = 'usage:';
  private readonly LIMIT_KEY_PREFIX = 'limit:';

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

  async expireLimit(userUuid: string): Promise<void> {
    await Promise.all([
      // TODO: Remove this line when all clients stop using the old API
      this.cacheManager.del(`${userUuid}$-limit`),
      this.cacheManager.del(`${this.LIMIT_KEY_PREFIX}${userUuid}`),
    ]);
  }

  async getUserStorageLimit(userUuid: string) {
    const cachedLimit = this.cacheManager.get<{ limit: number }>(
      `${this.LIMIT_KEY_PREFIX}${userUuid}`,
    );

    return cachedLimit;
  }

  async setUserStorageLimit(userUuid: string, limit: number) {
    const cachedLimit = await this.cacheManager.set(
      `${this.LIMIT_KEY_PREFIX}${userUuid}`,
      { limit },
      10000 * 60,
    );
    return cachedLimit;
  }
}
