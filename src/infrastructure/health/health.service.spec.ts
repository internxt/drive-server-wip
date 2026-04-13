import { ServiceUnavailableException, type Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Sequelize } from 'sequelize-typescript';
import { HealthService, HealthStatus, CheckStatus } from './health.service';
import { CacheManagerService } from '../../modules/cache-manager/cache-manager.service';

describe('HealthService', () => {
  let service: HealthService;
  let sequelize: DeepMocked<Sequelize>;
  let cacheManagerService: DeepMocked<CacheManagerService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [HealthService],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    service = moduleRef.get(HealthService);
    sequelize = moduleRef.get(Sequelize);
    cacheManagerService = moduleRef.get(CacheManagerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('check', () => {
    it('When all services are healthy, then it should return status ok', async () => {
      sequelize.authenticate.mockResolvedValue();
      cacheManagerService.checkHealth.mockResolvedValue();

      const result = await service.check();

      expect(result.status).toBe(HealthStatus.Ok);
      expect(result.checks.db.status).toBe(CheckStatus.Ok);
      expect(result.checks.redis.status).toBe(CheckStatus.Ok);
      expect(result.failedChecks).toHaveLength(0);
    });

    it('When DB is healthy, then it should include ping in db check', async () => {
      sequelize.authenticate.mockResolvedValue();
      cacheManagerService.checkHealth.mockResolvedValue();

      const result = await service.check();

      expect(result.checks.db.ping).toBeGreaterThanOrEqual(0);
    });

    it('When Redis fails, then it should return status degraded with redis in failedChecks', async () => {
      sequelize.authenticate.mockResolvedValue();
      cacheManagerService.checkHealth.mockRejectedValue(
        new Error('Connection refused'),
      );

      const result = await service.check();

      expect(result.status).toBe(HealthStatus.Degraded);
      expect(result.checks.redis.status).toBe(CheckStatus.Error);
      expect(result.failedChecks).toContain('redis');
    });

    it('When DB fails, then it should throw', async () => {
      sequelize.authenticate.mockRejectedValue(new Error('DB unreachable'));
      cacheManagerService.checkHealth.mockResolvedValue();

      await expect(service.check()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('When DB fails, then the exception payload should contain db in failedChecks', async () => {
      sequelize.authenticate.mockRejectedValue(new Error('DB unreachable'));
      cacheManagerService.checkHealth.mockResolvedValue();

      try {
        await service.check();
      } catch (err) {
        expect(err.response.failedChecks).toContain('db');
        expect(err.response.checks.db.status).toBe(CheckStatus.Error);
      }
    });
  });
});
