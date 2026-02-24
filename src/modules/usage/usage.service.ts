import { Injectable } from '@nestjs/common';
import { SequelizeUsageRepository } from './usage.repository';
import { type File } from '../file/file.domain';
import { type User } from '../user/user.domain';
import { Usage, UsageType } from './usage.domain';
import { v4 } from 'uuid';
import { Time } from '../../lib/time';

@Injectable()
export class UsageService {
  constructor(private readonly usageRepository: SequelizeUsageRepository) {}

  async getMostRecentTemporalUsage(
    userId: User['uuid'],
  ): Promise<Usage | null> {
    const mostRecentUsage =
      await this.usageRepository.getLatestTemporalUsage(userId);
    return mostRecentUsage;
  }
  async createDailyUsage(userUuid: User['uuid'], period: Date, delta: number) {
    const dailyUsage = Usage.build({
      id: v4(),
      userId: userUuid,
      period,
      delta,
      type: UsageType.Daily,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const createdDailyUsage = await this.usageRepository.create(dailyUsage);

    return createdDailyUsage;
  }
  async calculateFirstTemporalUsage(userUuid: User['uuid']) {
    return this.usageRepository.createFirstUsageCalculation(userUuid);
  }

  async calculateAggregatedUsage(userUuid: User['uuid']) {
    return this.usageRepository.calculateAggregatedUsage(userUuid);
  }

  async addFileReplacementDelta(
    user: User,
    oldFileData: File,
    newFileData: File,
  ): Promise<Usage | null> {
    const delta = Number(newFileData.size) - Number(oldFileData.size);

    // Files created the same day do not need a daily usage entry, they will be included in the next monthly usage
    const latestUsage = await this.usageRepository.getLatestTemporalUsage(
      user.uuid,
    );
    if (!latestUsage || delta === 0) {
      return null;
    }
    if (!latestUsage.isAtOrBeforePeriod(newFileData.createdAt)) {
      return null;
    }

    const currentDate = Time.now();
    const newUsage = Usage.build({
      id: v4(),
      userId: user.uuid,
      period: currentDate,
      delta,
      type: UsageType.Replacement,
      createdAt: currentDate,
      updatedAt: currentDate,
    });
    return this.usageRepository.create(newUsage);
  }
}
