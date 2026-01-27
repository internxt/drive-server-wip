import * as tsjest from '@golevelup/ts-jest';
import { CustomThrottlerInterceptor } from './throttler.interceptor';
import { CacheManagerService } from '../modules/cache-manager/cache-manager.service';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { of } from 'rxjs';

describe('CustomThrottlerInterceptor', () => {
  let interceptor: CustomThrottlerInterceptor;
  let configService: jest.Mocked<ConfigService>;
  let cacheService: jest.Mocked<CacheManagerService>;
  let reflector: Reflector;

  beforeEach(() => {
    configService = tsjest.createMock<ConfigService>();
    cacheService = tsjest.createMock<CacheManagerService>();
    cacheService.increment = jest.fn();
    reflector = tsjest.createMock<Reflector>();

    interceptor = new CustomThrottlerInterceptor(
      configService as any,
      cacheService as any,
      reflector,
    );
  });

  describe('intercept', () => {
    it('When handler or class has custom throttle metadata then bypasses global throttling', async () => {
      (reflector.get as jest.Mock).mockReturnValue(true);
      const context = tsjest.createMock<ExecutionContext>();
      const next: Partial<CallHandler> = { handle: jest.fn(() => of('ok')) };

      await interceptor.intercept(context, next as CallHandler);

      expect(
        (next.handle as jest.Mock).mock.calls.length,
      ).toBeGreaterThanOrEqual(1);
      expect(cacheService.increment).not.toHaveBeenCalled();
    });

    it('When anonymous request under limit then increments by ip and allows', async () => {
      (reflector.get as jest.Mock).mockReturnValue(undefined);
      configService.get = jest.fn((key: string) => {
        if (key === 'users.rateLimit.anonymous.ttl') return 30;
        if (key === 'users.rateLimit.anonymous.limit') return 10;
        return undefined;
      }) as any;

      const request: any = { ip: '10.0.0.1', user: null };
      const context = tsjest.createMock<ExecutionContext>();
      (context as any).switchToHttp = () => ({ getRequest: () => request });

      (cacheService.increment as jest.Mock).mockResolvedValue({
        totalHits: 1,
        timeToExpire: 1000,
      });
      const next: Partial<CallHandler> = { handle: jest.fn(() => of('ok')) };

      await interceptor.intercept(context, next as CallHandler);

      expect(cacheService.increment).toHaveBeenCalledWith(
        `rl:${request.ip}`,
        30,
      );
      expect(
        (next.handle as jest.Mock).mock.calls.length,
      ).toBeGreaterThanOrEqual(1);
    });

    it('When authenticated free-tier user exceeds limit then the request is throttled', async () => {
      (reflector.get as jest.Mock).mockReturnValue(undefined);
      const freeTierId = 'free-tier';
      configService.get = jest.fn((key: string) => {
        switch (key) {
          case 'users.freeTierId':
            return freeTierId;
          case 'users.rateLimit.free.ttl':
            return 20;
          case 'users.rateLimit.free.limit':
            return 1;
          default:
            return undefined;
        }
      }) as any;

      const request: any = {
        ip: '1.1.1.1',
        user: { uuid: 'u123', tierId: freeTierId },
      };
      const context = tsjest.createMock<ExecutionContext>();
      (context as any).switchToHttp = () => ({ getRequest: () => request });

      (cacheService.increment as jest.Mock).mockResolvedValue({
        totalHits: 5,
        timeToExpire: 100,
      });
      const next: Partial<CallHandler> = { handle: jest.fn(() => of('ok')) };

      await expect(
        interceptor.intercept(context, next as CallHandler),
      ).rejects.toBeInstanceOf(ThrottlerException);
      expect(cacheService.increment).toHaveBeenCalledWith(
        `rl:${request.user.uuid}`,
        20,
      );
    });
  });
});
