import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheManagerService } from './cache-manager.service';
import { Cache } from 'cache-manager';
import { createMock } from '@golevelup/ts-jest';
import { v4 } from 'uuid';

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
      const TTL_7_DAYS = 604800;

      await cacheManagerService.blacklistJwt(jti);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `jwt:${jti}`,
        true,
        TTL_7_DAYS,
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

      const result = await cacheManagerService.blacklistJwt(jti);

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
});
