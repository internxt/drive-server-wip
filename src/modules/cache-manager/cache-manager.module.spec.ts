import { Test } from '@nestjs/testing';
import { CacheManagerModule } from './cache-manager.module';
import { ConfigModule } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import * as keyvRedis from '@keyv/redis';

jest.mock('@keyv/redis');

describe('CacheManagerModule', () => {
  let loggerErrorSpy;
  let mockRedisClient;

  beforeEach(() => {
    mockRedisClient = new EventEmitter();
    (keyvRedis.createKeyv as jest.Mock) = jest
      .fn()
      .mockReturnValue(mockRedisClient);
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    loggerErrorSpy.mockRestore();
  });

  it('When error occur on redis client, then it should log it', async () => {
    await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              cache: {
                redisConnectionString: 'redis://localhost:6379',
              },
            }),
          ],
        }),
        CacheManagerModule,
      ],
    })
      .overrideProvider('CACHE_MANAGER')
      .useValue({})
      .compile();

    mockRedisClient.emit('error', new Error('Test Redis error'));

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error on redis client'),
    );
  });
});
