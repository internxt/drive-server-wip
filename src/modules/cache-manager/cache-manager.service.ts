import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Folder } from '../folder/folder.domain';

@Injectable()
export class CacheManagerService {
  private readonly USAGE_KEY_PREFIX = 'usage:';
  private readonly LIMIT_KEY_PREFIX = 'limit:';
  private readonly JWT_KEY_PREFIX = 'jwt:';
  private readonly AVATAR_KEY_PREFIX = 'avatar:';
  private readonly FOLDER_BY_PATH_PREFIX = 'folder:';
  private readonly TTL_10_MINUTES = 10000 * 60;
  private readonly TTL_24_HOURS = 24 * 60 * 60 * 1000;

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

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
      this.TTL_10_MINUTES,
    );

    return cachedUsage;
  }

  async expireUserUsage(userUuid: string): Promise<void> {
    await this.cacheManager.del(`${this.USAGE_KEY_PREFIX}${userUuid}`);
  }

  async expireLimit(userUuid: string): Promise<void> {
    await Promise.all([
      // TODO: Remove this line when all clients stop using the old API
      this.cacheManager.del(`${userUuid}-limit`),
      this.cacheManager.del(`${this.LIMIT_KEY_PREFIX}${userUuid}`),
    ]);
  }

  async getUserStorageLimit(userUuid: string) {
    const cachedLimit = this.cacheManager.get<{ limit: number }>(
      `${this.LIMIT_KEY_PREFIX}${userUuid}`,
    );

    return cachedLimit;
  }

  async setUserStorageLimit(userUuid: string, limit: number, ttl?: number) {
    const cachedLimit = await this.cacheManager.set(
      `${this.LIMIT_KEY_PREFIX}${userUuid}`,
      { limit },
      ttl ?? this.TTL_10_MINUTES,
    );
    return cachedLimit;
  }

  async blacklistJwt(jti: string, ttl: number) {
    const cacheJwt = await this.cacheManager.set(
      `${this.JWT_KEY_PREFIX}${jti}`,
      true,
      ttl,
    );
    return cacheJwt;
  }

  async isJwtBlacklisted(jti: string) {
    const cacheJwt = await this.cacheManager.get(
      `${this.JWT_KEY_PREFIX}${jti}`,
    );
    return !!cacheJwt;
  }

  async getUserAvatar(userUuid: string) {
    const cachedAvatar = await this.cacheManager.get<string>(
      `${this.AVATAR_KEY_PREFIX}${userUuid}`,
    );
    return cachedAvatar ?? null;
  }

  async setUserAvatar(userUuid: string, url: string, ttlMs?: number) {
    return this.cacheManager.set(
      `${this.AVATAR_KEY_PREFIX}${userUuid}`,
      url,
      ttlMs ?? this.TTL_24_HOURS,
    );
  }

  async deleteUserAvatar(userUuid: string) {
    return this.cacheManager.del(`${this.AVATAR_KEY_PREFIX}${userUuid}`);
  }

  private getFolderIdByPathKey(userId: string, path: string): string {
    return `${this.FOLDER_BY_PATH_PREFIX}${userId}-${path}`;
  }

  async setFolderIdByPath(userId: string, path: string, folderId: Folder['uuid']): Promise<void> {
    await this.cacheManager.set(
      this.getFolderIdByPathKey(userId, path),
      folderId,
      this.TTL_24_HOURS 
    );
  }

  async getFolderIdByPath(userId: string, path: string): Promise<Folder['uuid'] | null> {
    const folderId = await this.cacheManager.get<Folder['uuid'] | null>(
      this.getFolderIdByPathKey(userId, path),
    );
    return folderId;
  }
}
