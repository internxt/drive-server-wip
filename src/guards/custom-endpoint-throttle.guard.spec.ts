import * as tsjest from '@golevelup/ts-jest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CustomEndpointThrottleGuard } from './custom-endpoint-throttle.guard';
import { CacheManagerService } from '../modules/cache-manager/cache-manager.service';
import { ThrottlerException } from '@nestjs/throttler';

describe('CustomThrottleGuard', () => {
  let guard: CustomEndpointThrottleGuard;
  let reflector: Reflector;
  let cacheService: jest.Mocked<CacheManagerService>;

  beforeEach(() => {
    reflector = tsjest.createMock<Reflector>();
    cacheService = tsjest.createMock<CacheManagerService>();
    cacheService.increment = jest.fn();
    guard = new CustomEndpointThrottleGuard(reflector, cacheService as any);
  });

  describe('canActivate', () => {
    it('When reflector returns no metadata then the guard checks are skipped', async () => {
      (reflector.get as jest.Mock).mockReturnValue(undefined);
      const context = tsjest.createMock<ExecutionContext>();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(cacheService.increment).not.toHaveBeenCalled();
    });

    describe('Applying a single policy', () => {
      const route = '/login';

      it('When under limit then it allows the request to pass', async () => {
        const policy = { ttl: 60, limit: 5 };
        (reflector.get as jest.Mock).mockReturnValue(policy);

        const request: any = {
          route: { path: route },
          user: { uuid: 'user-1' },
          ip: '1.2.3.4',
        };
        (cacheService.increment as jest.Mock).mockResolvedValue({
          totalHits: 1,
          timeToExpire: 5000,
        });
        const context = tsjest.createMock<ExecutionContext>();
        (context as any).switchToHttp = () => ({ getRequest: () => request });

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(cacheService.increment).toHaveBeenCalledWith(
          `${request.route.path}:policy0:cet:uid:${request.user.uuid}`,
          60,
        );
      });

      it('When over the limit then the request is throttled', async () => {
        const policy = { ttl: 60, limit: 1 };
        (reflector.get as jest.Mock).mockReturnValue(policy);

        const request: any = {
          route: { path: route },
          user: { uuid: 'user-2' },
          ip: '2.2.2.2',
        };
        (cacheService.increment as jest.Mock).mockResolvedValue({
          totalHits: 2,
          timeToExpire: 1000,
        });
        const context = tsjest.createMock<ExecutionContext>();
        (context as any).switchToHttp = () => ({ getRequest: () => request });

        await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
          ThrottlerException,
        );
        expect(cacheService.increment).toHaveBeenCalledWith(
          `${request.route.path}:policy0:cet:uid:${request.user.uuid}`,
          60,
        );
      });
    });

    describe('Applying multiple policies', () => {
      const route = '/login';

      it('When under limits then it allows the request to pass', async () => {
        const named = {
          short: { ttl: 60, limit: 5 },
          long: { ttl: 3600, limit: 30 },
        };
        (reflector.get as jest.Mock).mockReturnValue(named);
        const request: any = {
          route: { path: route },
          user: null,
          ip: '9.9.9.9',
        };

        (cacheService.increment as jest.Mock)
          .mockResolvedValueOnce({
            totalHits: named.short.limit - 1,
            timeToExpire: 100,
          })
          .mockResolvedValueOnce({
            totalHits: named.long.limit - 1,
            timeToExpire: 1000,
          });

        const context = tsjest.createMock<ExecutionContext>();
        (context as any).switchToHttp = () => ({ getRequest: () => request });

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(cacheService.increment).toHaveBeenCalledWith(
          `${request.route.path}:short:cet:ip:${request.ip}`,
          named.short.ttl,
        );
        expect(cacheService.increment).toHaveBeenCalledWith(
          `${request.route.path}:long:cet:ip:${request.ip}`,
          named.long.ttl,
        );
      });

      it('when over the limit then the request is throttled', async () => {
        const named = {
          short: { ttl: 60, limit: 1 },
          long: { ttl: 3600, limit: 30 },
        };
        (reflector.get as jest.Mock).mockReturnValue(named);
        const request: any = {
          route: { path: route },
          user: null,
          ip: '11.11.11.11',
        };

        const shortOverTheLimit = named.short.limit + 1;
        (cacheService.increment as jest.Mock)
          .mockResolvedValueOnce({
            totalHits: shortOverTheLimit,
            timeToExpire: 10,
          })
          .mockResolvedValueOnce({
            totalHits: named.long.limit - 1,
            timeToExpire: 1000,
          });

        const context = tsjest.createMock<ExecutionContext>();
        (context as any).switchToHttp = () => ({ getRequest: () => request });

        await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
          ThrottlerException,
        );
        expect(cacheService.increment).toHaveBeenCalledWith(
          `${request.route.path}:short:cet:ip:${request.ip}`,
          60,
        );
      });
    });
  });
});
