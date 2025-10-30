import { Injectable } from '@nestjs/common';
import { SequelizeUsageRepository } from './usage.repository';
import { File } from '../file/file.domain';
import { User } from '../user/user.domain';
import { Usage, UsageType } from './usage.domain';
import { v4 } from 'uuid';

@Injectable()
export class UsageService {
  constructor(private readonly usageRepository: SequelizeUsageRepository) {}

  async getUserMostRecentUsage(userId: User['uuid']): Promise<Usage | null> {
    const mostRecentUsage =
      await this.usageRepository.getMostRecentMonthlyOrYearlyUsage(userId);
    return mostRecentUsage;
  }

  async createFirstUsageCalculation(userUuid: User['uuid']) {
    return this.usageRepository.createFirstUsageCalculation(userUuid);
  }

  async createMonthlyUsage(userId: User['uuid'], period: Date, delta: number) {
    const monthlyUsage = Usage.build({
      id: v4(),
      userId: userId,
      period,
      delta,
      type: UsageType.Monthly,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const createMonthlyUsage =
      await this.usageRepository.createMonthlyUsage(monthlyUsage);

    return createMonthlyUsage;
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

  async addDailyUsageChangeOnFileSizeChange(
    user: User,
    oldFileData: File,
    newFileData: File,
  ): Promise<Usage | null> {
    const delta = Number(newFileData.size) - Number(oldFileData.size);

    const recentUsage =
      await this.usageRepository.getMostRecentMonthlyOrYearlyUsage(user.uuid);

    if (!recentUsage || delta === 0) {
      return null;
    }
    if (!recentUsage.isAtOrBeforePeriod(newFileData.createdAt)) {
      return null;
    }

    return this.createDailyUsage(user.uuid, new Date(), delta);
  }
}
