import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { RedisService } from './redis.service';
import { createClient } from 'redis';

jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

describe('RedisService', () => {
  let service: RedisService;
  let configService: DeepMocked<ConfigService>;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockRedisClient = {
      connect: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
      set: jest.fn(),
      isOpen: false,
    };

    (createClient as jest.Mock).mockReturnValue(mockRedisClient);

    const moduleRef = await Test.createTestingModule({
      providers: [RedisService],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    service = moduleRef.get(RedisService);
    configService = moduleRef.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('When module initializes, then it should create redis client with correct configuration', async () => {
      const redisUrl = 'redis://localhost:6379';
      configService.get.mockReturnValue(redisUrl);
      mockRedisClient.connect.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(createClient).toHaveBeenCalledWith({
        url: redisUrl,
        socket: {
          reconnectStrategy: false,
        },
      });
    });

    it('When redis connection fails, then it should log the error but not throw', async () => {
      const redisUrl = 'redis://localhost:6379';
      const connectionError = new Error('Connection failed');

      configService.get.mockReturnValue(redisUrl);
      mockRedisClient.connect.mockRejectedValue(connectionError);

      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');

      await service.onModuleInit();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `There was an error while connecting to redis err: ${JSON.stringify(connectionError)}`,
      );
    });
  });

  describe('onModuleDestroy', () => {
    beforeEach(async () => {
      jest
        .spyOn(configService, 'get')
        .mockReturnValue('redis://localhost:6379');
      jest.spyOn(mockRedisClient, 'connect').mockResolvedValue(undefined);
      await service.onModuleInit();
    });

    it('When module is destroyed and client is open, then it should quit the redis connection', async () => {
      mockRedisClient.isOpen = true;
      jest.spyOn(mockRedisClient, 'quit').mockResolvedValue(undefined);

      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalledTimes(1);
    });

    it('When module is destroyed and client is not open, then it should not call quit', async () => {
      mockRedisClient.isOpen = false;
      const quitSpy = jest.spyOn(mockRedisClient, 'quit');

      await service.onModuleDestroy();

      expect(quitSpy).not.toHaveBeenCalled();
    });

    it('When module is destroyed and client is undefined, then it should not throw error', async () => {
      service['client'] = undefined;

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe('tryAcquireLock', () => {
    beforeEach(async () => {
      jest
        .spyOn(configService, 'get')
        .mockReturnValue('redis://localhost:6379');
      jest.spyOn(mockRedisClient, 'connect').mockResolvedValue(undefined);
      await service.onModuleInit();
    });

    it('When lock is successfully acquired, then it should return true', async () => {
      const key = 'test-lock';
      const ttlMs = 5000;

      jest.spyOn(mockRedisClient, 'set').mockResolvedValue('OK');

      const result = await service.tryAcquireLock(key, ttlMs);

      expect(mockRedisClient.set).toHaveBeenCalledWith(key, '1', {
        PX: ttlMs,
        NX: true,
      });
      expect(result).toBe(true);
    });

    it('When lock cannot be acquired because key already exists, then it should return false', async () => {
      const key = 'test-lock';
      const ttlMs = 5000;

      jest.spyOn(mockRedisClient, 'set').mockResolvedValue(null);

      const result = await service.tryAcquireLock(key, ttlMs);

      expect(mockRedisClient.set).toHaveBeenCalledWith(key, '1', {
        PX: ttlMs,
        NX: true,
      });
      expect(result).toBe(false);
    });

    it('When custom value is provided, then it should use that value for the lock', async () => {
      const key = 'test-lock';
      const ttlMs = 5000;
      const customValue = 'custom-lock-value';

      jest.spyOn(mockRedisClient, 'set').mockResolvedValue('OK');

      const result = await service.tryAcquireLock(key, ttlMs, customValue);

      expect(mockRedisClient.set).toHaveBeenCalledWith(key, customValue, {
        PX: ttlMs,
        NX: true,
      });
      expect(result).toBe(true);
    });
  });
});
