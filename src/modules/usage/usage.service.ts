import { Injectable } from '@nestjs/common';
import { SequelizeUsageRepository } from './usage.repository';
import { File } from '../file/file.domain';
import { User } from '../user/user.domain';
import { Usage, UsageType } from './usage.domain';
import { v4 } from 'uuid';
import { Time } from '../../lib/time';

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

  async findOrCreateMonthlyUsage(
    userId: User['uuid'],
    period: Date,
    delta: number,
  ) {
    const monthlyUsage = Usage.build({
      id: v4(),
      userId: userId,
      period,
      delta,
      type: UsageType.Monthly,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const createMonthlyUsage = await this.usageRepository.create(monthlyUsage);

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

    // Files created the same day do not need a daily usage entry, they will be included in the next monthly usage
    const isFileCreatedToday = Time.isToday(newFileData.createdAt);

    if (delta === 0 || isFileCreatedToday) {
      return null;
    }

    const doesUserHasAnyUsageCalculation =
      await this.usageRepository.getMostRecentMonthlyOrYearlyUsage(user.uuid);

    if (!doesUserHasAnyUsageCalculation) {
      return null;
    }

    return this.createDailyUsage(user.uuid, new Date(), delta);
  }
}
