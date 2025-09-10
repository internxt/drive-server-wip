import { Injectable, Logger } from '@nestjs/common';
import { SequelizeFeatureLimitsRepository } from './feature-limit.repository';
import { LimitLabels } from './limits.enum';
import { PlatformName } from '../../common/constants';

@Injectable()
export class FeatureLimitService {
  private readonly logger = new Logger(FeatureLimitService.name);

  constructor(
    private readonly limitsRepository: SequelizeFeatureLimitsRepository,
  ) {}

  async canUserAccessPlatform(tierId: string, platform: string) {
    const platformLimitLabelsMap: Record<PlatformName, LimitLabels> = {
      [PlatformName.CLI]: LimitLabels.CliAccess,
    };

    const limit = await this.limitsRepository.findLimitByLabelAndTier(
      tierId,
      platformLimitLabelsMap[platform],
    );

    if (!limit) {
      this.logger.warn(
        {
          tierId,
          platform,
          category: 'MISSING-LIMIT',
        },
        'Missing platform access limit for tier, bypassing access check',
      );
      return true;
    }

    return !limit.shouldLimitBeEnforced();
  }

  async getTier(tierId: string) {
    return this.limitsRepository.findTierById(tierId);
  }
}
