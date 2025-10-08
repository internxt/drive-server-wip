import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SequelizeFeatureLimitsRepository } from './feature-limit.repository';
import { LimitLabels } from './limits.enum';
import { PlatformName } from '../../common/constants';
import { SequelizeWorkspaceRepository } from '../workspaces/repositories/workspaces.repository';
import { SequelizeUserRepository } from '../user/user.repository';
import { User } from '../user/user.domain';

@Injectable()
export class FeatureLimitService {
  private readonly logger = new Logger('FEATURE_LIMITS/SERVICE');

  constructor(
    private readonly limitsRepository: SequelizeFeatureLimitsRepository,
    private readonly workspaceRepository: SequelizeWorkspaceRepository,
    private readonly userRepository: SequelizeUserRepository,
  ) {}

  async canUserAccessPlatform(
    platform: string,
    userUuid: string,
  ): Promise<boolean> {
    const platformLimitLabelsMap: Record<PlatformName, LimitLabels> = {
      [PlatformName.CLI]: LimitLabels.CliAccess,
    };
    const limitLabel = platformLimitLabelsMap[platform];

    if (!limitLabel) {
      this.logger.warn(
        {
          platform,
          category: 'UNKNOWN_PLATFORM',
          userUuid,
        },
        'Missing platform configuration bypassing access',
      );
      return true;
    }

    const user = await this.userRepository.findByUuid(userUuid);
    if (!user) throw new NotFoundException('User not found');

    const workspaceTiersIds = await this.getUserBussinessTiers(user.uuid);
    const tierIds = [user.tierId, ...workspaceTiersIds];
    const tierLimits = await this.limitsRepository.findLimitsByLabelAndTiers(
      tierIds,
      limitLabel,
    );

    if (!tierLimits.length) {
      this.logger.warn(
        {
          platform,
          userUuid,
          category: 'MISSING_LIMIT',
        },
        'Missing platform acccess limit for this user or its workspaces, bypassing access check',
      );
      return true;
    }

    for (const limit of tierLimits) {
      if (!limit.shouldLimitBeEnforced()) {
        return true;
      }
    }

    return false;
  }

  async getUserBussinessTiers(userUuid: string): Promise<string[]> {
    const workspaces = await this.workspaceRepository.findByOwner(userUuid);
    if (workspaces.length === 0) {
      return [];
    }

    const workspaceUserIds = workspaces.map((ws) => ws.workspaceUserId);
    const workspaceUsers =
      await this.userRepository.findByUuids(workspaceUserIds);

    const workspaceTierIds = workspaceUsers
      .filter((wu) => wu?.tierId)
      .map((wu) => wu.tierId);

    return workspaceTierIds;
  }

  async getTier(tierId: string) {
    return this.limitsRepository.findTierById(tierId);
  }
}
