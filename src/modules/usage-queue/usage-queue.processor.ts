import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { type Job } from 'bullmq';
import { type User } from '../user/user.domain';
import { FileUseCases } from '../file/file.usecase';
import { BackupUseCase } from '../backups/backup.usecase';
import { CacheManagerService } from '../cache-manager/cache-manager.service';
import { USAGE_QUEUE_NAME } from './usage-queue.constants';

export interface UsageJobData {
  userUuid: string;
  userId: number;
  source: string;
}

@Processor(USAGE_QUEUE_NAME)
export class UsageQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(UsageQueueProcessor.name);

  constructor(
    private readonly fileUseCases: FileUseCases,
    private readonly backupUseCases: BackupUseCase,
    private readonly cacheManager: CacheManagerService,
  ) {
    super();
  }

  async process(job: Job<UsageJobData>): Promise<void> {
    const { userUuid, userId, source } = job.data;

    this.logger.log(
      `Recomputing usage for user ${userUuid} (source: ${source})`,
    );

    const user = { uuid: userUuid, id: userId } as User;

    const [driveUsage, backupUsage] = await Promise.all([
      this.fileUseCases.getUserUsedStorage(user),
      this.backupUseCases.sumExistentBackupSizes(userId),
    ]);

    await this.cacheManager.setUserUsage(userUuid, driveUsage, backupUsage);

    this.logger.log(
      `Usage recomputed for user ${userUuid}: drive=${driveUsage}, backup=${backupUsage}`,
    );
  }
}
