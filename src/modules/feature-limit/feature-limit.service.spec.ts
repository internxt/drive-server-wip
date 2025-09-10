import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { FeatureLimitService } from './feature-limit.service';
import { SequelizeFeatureLimitsRepository } from './feature-limit.repository';
import { LimitLabels } from './limits.enum';
import { PlatformName } from '../../common/constants';
import { Limit } from './limit.domain';
import { v4 } from 'uuid';

describe('FeatureLimitService', () => {
  let service: FeatureLimitService;
  let limitsRepository: DeepMocked<SequelizeFeatureLimitsRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [FeatureLimitService],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    service = moduleRef.get<FeatureLimitService>(FeatureLimitService);
    limitsRepository = moduleRef.get(SequelizeFeatureLimitsRepository);
  });

  describe('canUserAccessPlatform', () => {
    it('When limit exists and allows access, then it should return true', async () => {
      const tierId = v4();
      const platform = PlatformName.CLI;
      const mockLimit = createMock<Limit>();
      mockLimit.shouldLimitBeEnforced.mockReturnValueOnce(false);

      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(mockLimit);

      const result = await service.canUserAccessPlatform(tierId, platform);

      expect(limitsRepository.findLimitByLabelAndTier).toHaveBeenCalledWith(
        tierId,
        LimitLabels.CliAccess,
      );
      expect(result).toBe(true);
    });

    it('When limit exists and denies access, then it should return false', async () => {
      const tierId = v4();
      const platform = PlatformName.CLI;
      const mockLimit = createMock<Limit>();
      mockLimit.shouldLimitBeEnforced.mockReturnValueOnce(true);

      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(mockLimit);

      const result = await service.canUserAccessPlatform(tierId, platform);

      expect(limitsRepository.findLimitByLabelAndTier).toHaveBeenCalledWith(
        tierId,
        LimitLabels.CliAccess,
      );
      expect(result).toBe(false);
    });

    it('When limit does not exist, then it should return true', async () => {
      const tierId = v4();
      const platform = PlatformName.CLI;

      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(null);

      const result = await service.canUserAccessPlatform(tierId, platform);

      expect(limitsRepository.findLimitByLabelAndTier).toHaveBeenCalledWith(
        tierId,
        LimitLabels.CliAccess,
      );
      expect(result).toBe(true);
    });
  });
});
