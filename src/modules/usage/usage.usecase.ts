import { Injectable } from '@nestjs/common';
import { SequelizeUsageRepository } from './usage.repository';
import { SequelizeFileRepository } from '../file/file.repository';
import { User } from '../user/user.domain';

@Injectable()
export class UsageUseCases {
  constructor(
    private readonly usageRepository: SequelizeUsageRepository,
    private readonly fileRepository: SequelizeFileRepository,
  ) {}

  async getUserUsage(user: User) {
    const userUuid = user.uuid;

    let mostRecentUsage =
      await this.usageRepository.getMostRecentUsage(userUuid);

    if (!mostRecentUsage) {
      mostRecentUsage = await this.usageRepository.addFirstDailyUsage(userUuid);
    }

    const mostRecentUsageNextDay = new Date(mostRecentUsage.period);
    mostRecentUsageNextDay.setUTCDate(mostRecentUsageNextDay.getUTCDate() + 1);

    const totalStorageChanged = await this.fileRepository.sumFileSizesSinceDate(
      user.id,
      mostRecentUsageNextDay,
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
}
