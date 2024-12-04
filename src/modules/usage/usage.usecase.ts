import { Injectable } from '@nestjs/common';
import { SequelizeUsageRepository } from './usage.repository';
import { File } from '../file/file.domain';
import { SequelizeFileRepository } from '../file/file.repository';
import { User } from '../user/user.domain';
import { Usage, UsageType } from './usage.domain';
import { v4 } from 'uuid';
import { Time } from '../../lib/time';

@Injectable()
export class UsageUseCases {
  constructor(
    private readonly usageRepository: SequelizeUsageRepository,
    private readonly fileRepository: SequelizeFileRepository,
  ) {}

  async getUserUsage(user: User) {
    const userUuid = user.uuid;

    let mostRecentUsage =
      await this.usageRepository.getMostRecentMonthlyOrYearlyUsage(userUuid);

    if (!mostRecentUsage) {
      mostRecentUsage =
        await this.usageRepository.addFirstMonthlyUsage(userUuid);
    }

    const calculateSizeChangesSince = new Date(mostRecentUsage.period);

    if (mostRecentUsage.isYearly()) {
      calculateSizeChangesSince.setUTCFullYear(
        calculateSizeChangesSince.getUTCFullYear() + 1,
      );
    } else {
      calculateSizeChangesSince.setUTCDate(
        calculateSizeChangesSince.getUTCDate() + 1,
      );
    }

    const totalStorageChanged = await this.fileRepository.sumFileSizesSinceDate(
      user.id,
      calculateSizeChangesSince,
    );

    const totalUsage = await this.usageRepository.getUserUsage(userUuid);

    return {
      drive:
        totalUsage.total_yearly_delta +
        totalUsage.total_monthly_delta +
        totalStorageChanged,
      id: user.email,
    };
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

  /*   async addDailyUsageChangeOnFileSizeChange(
    user: User,
    oldFileData: File,
    newFileData: File,
  ) {
    const mostRecentDailyUsage = await this.usageRepository.getUsage(
      {
        type: UsageType.Daily,
        userId: user.uuid,
      },
      [['createdAt', 'DESC']],
    );

    let calculateChangesSince: Date = mostRecentDailyUsage?.createdAt;
    const now = new Date();

    if (
      !calculateChangesSince ||
      new Date(calculateChangesSince).toDateString() !== now.toDateString()
    ) {
      calculateChangesSince = new Date(now);
      calculateChangesSince.setUTCHours(0, 0, 0, 0);
    }

    const totalStorageChanged = await this.fileRepository.sumFileSizesSinceDate(
      user.id,
      calculateChangesSince,
    );

    if (newFileData.createdAt.toDateString() !== now.toDateString()) {
      const delta =
        Number(newFileData.size) -
        Number(oldFileData.size) +
        totalStorageChanged;

      return this.createDailyUsage(user.uuid, new Date(), delta);
    }

    const delta = totalStorageChanged;

    console.log({ totalStorageChanged, delta });

    return this.createDailyUsage(user.uuid, new Date(), delta);
  } */

  async addDailyUsageChangeOnFileSizeChange(
    user: User,
    oldFileData: File,
    newFileData: File,
  ): Promise<Usage | null> {
    const maybeExistentUsage =
      await this.usageRepository.getMostRecentMonthlyOrYearlyUsage(user.uuid);

    if (!maybeExistentUsage) {
      return null;
    }

    const delta = Number(newFileData.size) - Number(oldFileData.size);

    // Files created the same day are going to be included in the next cronjob run
    const isFileCreatedToday = Time.isToday(newFileData.createdAt);

    if (delta === 0 || isFileCreatedToday) {
      return null;
    }

    return this.createDailyUsage(user.uuid, new Date(), delta);
  }
}
