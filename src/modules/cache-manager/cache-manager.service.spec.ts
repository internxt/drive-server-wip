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
      const returnValue = { result: 'success' };

      jest.spyOn(cacheManager, 'set').mockResolvedValue(returnValue as any);

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

      await cacheManagerService.expireLimit(userUuid);

      expect(cacheManager.del).toHaveBeenCalledWith(`${userUuid}$-limit`);
      expect(cacheManager.del).toHaveBeenCalledWith(`limit:${userUuid}`);
    });
  });
});
