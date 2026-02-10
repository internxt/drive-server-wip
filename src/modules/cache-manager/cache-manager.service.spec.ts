import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheManagerService } from './cache-manager.service';
import { Cache } from 'cache-manager';
import { createMock } from '@golevelup/ts-jest';
import { v4 } from 'uuid';
import { JWT_7DAYS_EXPIRATION } from '../auth/constants';

describe('CacheManagerService', () => {
  let cacheManagerService: CacheManagerService;
  let cacheManager: Cache;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CacheManagerService],
    })
      .useMocker(() => createMock())
      .setLogger(createMock())
      .compile();

    cacheManagerService =
      moduleRef.get<CacheManagerService>(CacheManagerService);
    cacheManager = moduleRef.get<Cache>(CACHE_MANAGER);

    jest.clearAllMocks();
  });

  describe('getUserUsage', () => {
    it('When getting user usage, then it should append the user uuid to the usage key prefix', async () => {
      const userUuid = v4();
      const cachedUsage = { usage: 1024 };

      jest.spyOn(cacheManager, 'get').mockResolvedValue(cachedUsage);

      const result = await cacheManagerService.getUserUsage(userUuid);

      expect(cacheManager.get).toHaveBeenCalledWith(`usage:${userUuid}`);
      expect(result).toEqual(cachedUsage);
    });

    it('When cache returns null for user usage, then it should return null', async () => {
      const userUuid = v4();

      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);

      const result = await cacheManagerService.getUserUsage(userUuid);

      expect(cacheManager.get).toHaveBeenCalledWith(`usage:${userUuid}`);
      expect(result).toBeNull();
    });
  });

  describe('setUserUsage', () => {
    it('When setting user usage, then it should store the usage with correct key and expiration', async () => {
      const userUuid = v4();
      const usage = 2048;

      await cacheManagerService.setUserUsage(userUuid, usage);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `usage:${userUuid}`,
        { usage },
        10000 * 60,
      );
    });

    it('When user usage is set, then it should return set value', async () => {
      const userUuid = v4();
      const usage = 1024;
      const returnValue = { usage };

      jest.spyOn(cacheManager, 'set').mockResolvedValue(returnValue);

      const result = await cacheManagerService.setUserUsage(userUuid, usage);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `usage:${userUuid}`,
        { usage },
        10000 * 60,
      );
      expect(result).toEqual(returnValue);
    });
  });

  describe('expireLimit', () => {
    it('When called, then it should expire limit with old and new keys', async () => {
      const userUuid = v4();
      jest.spyOn(cacheManager, 'del').mockResolvedValue(true);
      await cacheManagerService.expireLimit(userUuid);

      expect(cacheManager.del).toHaveBeenCalledWith(`${userUuid}-limit`);
      expect(cacheManager.del).toHaveBeenCalledWith(`limit:${userUuid}`);
    });
  });

  describe('expireUserUsage', () => {
    it('When called, then it should expire the cached usage', async () => {
      const userUuid = v4();
      jest.spyOn(cacheManager, 'del').mockResolvedValue(true);
      await cacheManagerService.expireUserUsage(userUuid);

      expect(cacheManager.del).toHaveBeenCalledWith(`usage:${userUuid}`);
    });
  });

  describe('setUserStorageLimit', () => {
    it('When setting user storage limit, then it should store the limit with correct key and expiration', async () => {
      const userUuid = v4();
      const limit = 2048;

      await cacheManagerService.setUserStorageLimit(userUuid, limit);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `limit:${userUuid}`,
        { limit },
        10000 * 60,
      );
    });

    it('When user limit is set, then it should return set value', async () => {
      const userUuid = v4();
      const limit = 2048;
      const returnValue = { limit };

      jest.spyOn(cacheManager, 'set').mockResolvedValue(returnValue);

      const result = await cacheManagerService.setUserStorageLimit(
        userUuid,
        limit,
      );

      expect(cacheManager.set).toHaveBeenCalledWith(
        `limit:${userUuid}`,
        { limit },
        10000 * 60,
      );
      expect(result).toEqual(returnValue);
    });

    it('When setting user storage limit with a custom TTL, then it should store the limit with the custom TTL', async () => {
      const userUuid = v4();
      const limit = 4096;
      const customTtl = 5000 * 60;

      await cacheManagerService.setUserStorageLimit(userUuid, limit, customTtl);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `limit:${userUuid}`,
        { limit },
        customTtl,
      );
    });
  });

  describe('getUserStorageLimit', () => {
    it('When getting user storage limit, then it should append the user uuid to the limit key prefix', async () => {
      const userUuid = v4();
      const cachedLimit = { limit: 1073741824 }; // 1GB

      jest.spyOn(cacheManager, 'get').mockResolvedValue(cachedLimit);

      const result = await cacheManagerService.getUserStorageLimit(userUuid);

      expect(cacheManager.get).toHaveBeenCalledWith(`limit:${userUuid}`);
      expect(result).toEqual(cachedLimit);
    });

    it('When cache returns null for user storage limit, then it should return null', async () => {
      const userUuid = v4();

      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);

      const result = await cacheManagerService.getUserStorageLimit(userUuid);

      expect(cacheManager.get).toHaveBeenCalledWith(`limit:${userUuid}`);
      expect(result).toBeNull();
    });
  });

  describe('blacklistJwt', () => {
    it('When blacklisting a JWT, then it should store the JTI with correct key and default TTL', async () => {
      const jti = v4();

      await cacheManagerService.blacklistJwt(jti, JWT_7DAYS_EXPIRATION);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `jwt:${jti}`,
        true,
        JWT_7DAYS_EXPIRATION,
      );
    });

    it('When blacklisting a JWT with custom TTL, then it should store the JTI with the custom TTL', async () => {
      const jti = v4();
      const customTtl = 3600;

      await cacheManagerService.blacklistJwt(jti, customTtl);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `jwt:${jti}`,
        true,
        customTtl,
      );
    });

    it('When JWT is blacklisted, then it should return the cache manager set result', async () => {
      const jti = 'test-jwt-id-789';
      const returnValue = true;

      jest.spyOn(cacheManager, 'set').mockResolvedValue(returnValue);

      const result = await cacheManagerService.blacklistJwt(
        jti,
        JWT_7DAYS_EXPIRATION,
      );

      expect(result).toEqual(returnValue);
    });
  });

  describe('isJwtBlacklisted', () => {
    it('When checking if JWT is blacklisted, then it should return true', async () => {
      const jti = v4();

      jest.spyOn(cacheManager, 'get').mockResolvedValue({});

      const isBlacklisted = await cacheManagerService.isJwtBlacklisted(jti);

      expect(isBlacklisted).toBe(true);
    });

    it('When JWT is not blacklisted, then it should return false', async () => {
      const jti = v4();

      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);

      const result = await cacheManagerService.isJwtBlacklisted(jti);

      expect(result).toBe(false);
    });
  });

  describe('user avatar cache', () => {
    describe('getUserAvatar', () => {
      it('When getting user avatar, then it should append the user uuid to the avatar key prefix', async () => {
        const userUuid = v4();
        const url = 'https://cdn.example.com/avatar.png';

        jest.spyOn(cacheManager, 'get').mockResolvedValue(url as string);

        const result = await cacheManagerService.getUserAvatar(userUuid);

        expect(cacheManager.get).toHaveBeenCalledWith(`avatar:${userUuid}`);
        expect(result).toEqual(url);
      });

      it('When cache returns null for user avatar, then it should return null', async () => {
        const userUuid = v4();

        jest.spyOn(cacheManager, 'get').mockResolvedValue(null);

        const result = await cacheManagerService.getUserAvatar(userUuid);

        expect(cacheManager.get).toHaveBeenCalledWith(`avatar:${userUuid}`);
        expect(result).toBeNull();
      });
    });

    describe('setUserAvatar', () => {
      it('When setting user avatar, then it should store the url with correct key and default expiration', async () => {
        const userUuid = v4();
        const url = 'https://cdn.example.com/avatar-default.png';

        await cacheManagerService.setUserAvatar(userUuid, url);

        expect(cacheManager.set).toHaveBeenCalledWith(
          `avatar:${userUuid}`,
          url,
          24 * 60 * 60 * 1000,
        );
      });

      it('When setting user avatar with a custom TTL, then it should store with the custom TTL', async () => {
        const userUuid = v4();
        const url = 'https://cdn.example.com/avatar-custom.png';
        const customTtl = 2 * 60 * 60 * 1000; // 2 hours

        await cacheManagerService.setUserAvatar(userUuid, url, customTtl);

        expect(cacheManager.set).toHaveBeenCalledWith(
          `avatar:${userUuid}`,
          url,
          customTtl,
        );
      });
    });

    describe('deleteUserAvatar', () => {
      it('When deleting user avatar, then it should remove the correct key', async () => {
        const userUuid = v4();

        jest.spyOn(cacheManager, 'del').mockResolvedValue(true as boolean);

        await cacheManagerService.deleteUserAvatar(userUuid);

        expect(cacheManager.del).toHaveBeenCalledWith(`avatar:${userUuid}`);
      });
    });
  });

  describe('getRecord', () => {
    const key = 'throttle:some:key';

    it('When entry exists and not expired then returns a record succesfully', async () => {
      const now = 1_600_000_000_000;
      const expirationTTL = 5_000;
      const expiresAt = now + expirationTTL;
      const entry = { hits: 3, expiresAt };

      jest.spyOn(Date, 'now').mockReturnValue(now);
      jest.spyOn(cacheManager, 'get').mockResolvedValue(entry as any);

      const result = await cacheManagerService.getRecord(key);

      expect(cacheManager.get).toHaveBeenCalledWith(key);
      expect(result).toEqual({
        totalHits: 3,
        timeToExpire: expirationTTL,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
    });

    it('When entry exists but expired then returns record with time to expire set to 0', async () => {
      const now = 1_600_000_010_000;
      const expiresAt = now - 1_000;
      const entry = { hits: 2, expiresAt };

      jest.spyOn(Date, 'now').mockReturnValue(now);
      jest.spyOn(cacheManager, 'get').mockResolvedValue(entry as any);

      const result = await cacheManagerService.getRecord(key);

      expect(result).toEqual({
        totalHits: 2,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
    });

    it('When cache returns null then returns undefined', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);

      const result = await cacheManagerService.getRecord(key);

      expect(result).toBeUndefined();
    });
  });

  describe('increment', () => {
    const key = 'throttle:some:key';

    it('When there is no existing entry then it sets hits=1 and ttl equals requested ttl (ms)', async () => {
      const now = 1_600_000_020_000;
      const ttlMs = 60_000;

      jest.spyOn(Date, 'now').mockReturnValue(now);
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      const setSpy = jest
        .spyOn(cacheManager, 'set')
        .mockResolvedValue(undefined as any);

      const result = await cacheManagerService.increment(key, ttlMs);

      expect(cacheManager.get).toHaveBeenCalledWith(key);
      expect(setSpy).toHaveBeenCalledWith(
        key,
        { hits: 1, expiresAt: now + ttlMs },
        ttlMs,
      );
      expect(result.totalHits).toBe(1);
      expect(result.timeToExpire).toBe(ttlMs);
    });

    it('When existing entry present and not expired then it increments hits and preserves the expiration time', async () => {
      const now = 1_600_000_030_000;
      const expiresAt = now + 3_000;
      const existing = { hits: 2, expiresAt };
      const ttlMs = 10_000;

      jest.spyOn(Date, 'now').mockReturnValue(now);
      jest.spyOn(cacheManager, 'get').mockResolvedValue(existing as any);
      const setSpy = jest
        .spyOn(cacheManager, 'set')
        .mockResolvedValue(undefined as any);

      const result = await cacheManagerService.increment(key, ttlMs);
      const expectedNewHits = existing.hits + 1;

      expect(setSpy).toHaveBeenCalledWith(
        key,
        { hits: expectedNewHits, expiresAt },
        expiresAt - now,
      );
      expect(result.totalHits).toBe(expectedNewHits);
      expect(result.timeToExpire).toBe(expiresAt - now);
    });

    it('When existing entry expired then it sets hits=1 and ttl equals requested ttl (ms)', async () => {
      const now = 1_600_000_040_000;
      const expiresAt = now - 500;
      const existing = { hits: 5, expiresAt };
      const ttlMs = 30_000;

      jest.spyOn(Date, 'now').mockReturnValue(now);
      jest.spyOn(cacheManager, 'get').mockResolvedValue(existing as any);
      const setSpy = jest
        .spyOn(cacheManager, 'set')
        .mockResolvedValue(undefined as any);

      const result = await cacheManagerService.increment(key, ttlMs);
      const expectedNewHits = 1;
      const expectedTimeToExpire = ttlMs;

      expect(setSpy).toHaveBeenCalledWith(
        key,
        {
          hits: expectedNewHits,
          expiresAt: now + expectedTimeToExpire,
        },
        expectedTimeToExpire,
      );
      expect(result.totalHits).toBe(expectedNewHits);
      expect(result.timeToExpire).toBe(expectedTimeToExpire);
    });
  });
});
