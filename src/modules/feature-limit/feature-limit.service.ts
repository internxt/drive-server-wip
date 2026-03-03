import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SequelizeFeatureLimitsRepository } from './feature-limit.repository';
import { LimitLabels } from './limits.enum';
import { PlatformName } from '../../common/constants';
import { SequelizeWorkspaceRepository } from '../workspaces/repositories/workspaces.repository';
import { SequelizeUserRepository } from '../user/user.repository';
import { type Limit } from './domain/limit.domain';
import { type User } from '../user/user.domain';

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
      [PlatformName.RCLONE]: LimitLabels.RcloneAccess,
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

    const userOverriddenLimit =
      await this.limitsRepository.findUserOverriddenLimit(
        user.uuid,
        limitLabel,
      );

    if (userOverriddenLimit) {
      return userOverriddenLimit.isFeatureEnabled();
    }

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
      if (limit.isFeatureEnabled()) {
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

  async getFileVersioningLimits(userUuid: string): Promise<{
    enabled: boolean;
    maxFileSize: number;
    retentionDays: number;
    maxVersions: number;
  }> {
    const user = await this.userRepository.findByUuid(userUuid);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.getFileVersioningLimitsByTier(userUuid, user.tierId);
  }

  async getFileVersioningLimitsByTier(
    userUuid: string,
    tierId: string,
  ): Promise<{
    enabled: boolean;
    maxFileSize: number;
    retentionDays: number;
    maxVersions: number;
  }> {
    const fileVersioningLabels = [
      LimitLabels.FileVersionEnabled,
      LimitLabels.FileVersionMaxSize,
      LimitLabels.FileVersionRetentionDays,
      LimitLabels.FileVersionMaxNumber,
    ];

    const [userOverriddenLimits, tierLimits] = await Promise.all([
      this.limitsRepository.findUserOverriddenLimitsByLabels(
        userUuid,
        fileVersioningLabels,
      ),
      this.limitsRepository.findLimitsByLabelsAndTier(
        tierId,
        fileVersioningLabels,
      ),
    ]);

    const limitsMap = new Map<string, string>();

    for (const limit of tierLimits) {
      limitsMap.set(limit.label, limit.value);
    }

    for (const limit of userOverriddenLimits) {
      limitsMap.set(limit.label, limit.value);
    }

    return {
      enabled:
        limitsMap.get(LimitLabels.FileVersionEnabled) === 'true' || false,
      maxFileSize: Number(limitsMap.get(LimitLabels.FileVersionMaxSize)) || 0,
      retentionDays:
        Number(limitsMap.get(LimitLabels.FileVersionRetentionDays)) || 0,
      maxVersions: Number(limitsMap.get(LimitLabels.FileVersionMaxNumber)) || 0,
    };
  }

  async getUserLimitByLabel(label: LimitLabels, user: User): Promise<Limit> {
    const [userOverriddenLimits, tierLimits] = await Promise.all([
      this.limitsRepository.findUserOverriddenLimit(user.uuid, label),
      this.limitsRepository.findLimitByLabelAndTier(user.tierId, label),
    ]);

    return userOverriddenLimits ?? tierLimits;
  }
}
