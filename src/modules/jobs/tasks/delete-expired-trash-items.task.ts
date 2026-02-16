import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobName } from '../constants';
import { RedisService } from '../../../externals/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';
import { SequelizeTrashRepository } from '../../trash/trash.repository';
import { TrashUseCases } from '../../trash/trash.usecase';

@Injectable()
export class DeleteExpiredTrashItemsTask {
  private readonly logger = new Logger(DeleteExpiredTrashItemsTask.name);
  private readonly lockTtl = 60 * 1000; // 1 minute
  private readonly lockKey = 'cleanup:expired-trash-items';

  constructor(
    private readonly jobExecutionRepository: SequelizeJobExecutionRepository,
    private readonly trashRepository: SequelizeTrashRepository,
    private readonly trashUseCases: TrashUseCases,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES, {
    name: JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
  })
  async scheduleCleanup() {
    const shouldExecuteCronjobs = this.configService.get<boolean>(
      'executeCronjobs',
      false,
    );

    if (!shouldExecuteCronjobs) {
      return;
    }

    try {
      const acquired = await this.redisService.tryAcquireLock(
        this.lockKey,
        this.lockTtl,
      );

      if (!acquired) {
        this.logger.log(
          'Lock already acquired by another instance, skipping...',
        );
        return;
      }

      this.logger.log('Lock acquired! Starting expired trash items cleanup job');
      await this.startJob();
    } catch (error) {
      this.logger.error(
        `Expired trash items cleanup job could not be setup. error: ${JSON.stringify({
          timestamp: new Date().toISOString(),
          name: error.name,
          message: error.message,
          stack: error.stack,
        })}`,
      );
    }
  }

  async startJob() {
    const { lastCompletedJob, startedJob } =
      await this.initializeJobExecution();

    this.logger.log(
      `[${startedJob.id}] Starting expired trash items cleanup job${
        lastCompletedJob
          ? ` (last completed: ${lastCompletedJob.completedAt})`
          : ' (first run)'
      }`,
    );

    try {
      let totalFilesDeleted = 0;
      let totalFoldersDeleted = 0;
      const batchSize = 100;

      for await (const expiredItems of this.yieldExpiredTrashItems(batchSize)) {
        if (expiredItems.length === 0) {
          break;
        }

        const result = await this.trashUseCases.deleteExpiredItems(
          expiredItems,
        );
        totalFilesDeleted += result.filesDeleted;
        totalFoldersDeleted += result.foldersDeleted;
      }

      await this.jobExecutionRepository.markAsCompleted(startedJob.id, {
        filesDeleted: totalFilesDeleted,
        foldersDeleted: totalFoldersDeleted,
      });

      this.logger.log(
        `[${startedJob.id}] Cleanup completed: ${totalFilesDeleted} files and ${totalFoldersDeleted} folders deleted`,
      );
    } catch (error) {
      this.logger.error(
        `[${startedJob.id}] Error: ${error.message}`,
      );
      await this.jobExecutionRepository.markAsFailed(startedJob.id, {
        errorMessage: error.message,
      });
      throw error;
    }
  }

  async initializeJobExecution(jobMetadata?: Record<string, any>) {
    const lastCompletedJob =
      await this.jobExecutionRepository.getLastSuccessful(
        JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
      );

    const startedJob = await this.jobExecutionRepository.startJob(
      JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
      jobMetadata,
    );

    return { lastCompletedJob, startedJob };
  }

  private async *yieldExpiredTrashItems(batchSize: number) {
    let resultCount = 0;

    do {
      const expiredItems = await this.trashRepository.findExpiredItems(
        batchSize,
      );

      resultCount = expiredItems.length;

      if (resultCount > 0) {
        yield expiredItems;
      }
    } while (resultCount === batchSize);
  }
}
