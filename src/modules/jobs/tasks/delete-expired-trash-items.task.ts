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

    const jobId = startedJob.id;
    const lastRun = lastCompletedJob
      ? `(last completed: ${lastCompletedJob.completedAt})`
      : '(first run)';

    this.logger.log(
      `[${jobId}] Starting expired trash items cleanup job ${lastRun}`,
    );

    try {
      const result = await this.deleteExpiredTrashItems();

      const completedJob = await this.jobExecutionRepository.markAsCompleted(
        startedJob.id,
        {
          filesDeleted: result.filesDeleted,
        },
      );

      this.logger.log(
        `[${jobId}] Cleanup completed at ${completedJob?.completedAt}: ${result.filesDeleted} files deleted`,
      );
    } catch (error) {
      const errorMessage = error.message;
      this.logger.error(
        `[${jobId}] Error while executing expired trash items cleanup: ${errorMessage}`,
      );
      await this.jobExecutionRepository.markAsFailed(startedJob.id, {
        errorMessage,
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

  private async deleteExpiredTrashItems(): Promise<{
    filesDeleted: number;
  }> {
    let totalFilesDeleted = 0;
    const batchSize = 100;

    for await (const expiredItems of this.yieldExpiredTrashItems(batchSize)) {
      if (expiredItems.length === 0) {
        this.logger.log('No more expired trash items to process');
        break;
      }

      this.logger.log(
        `Found ${expiredItems.length} expired trash items to delete`,
      );

      const fileUuids = expiredItems.map((item) => item.itemId);
      const deletedCount = await this.trashUseCases.deleteExpiredItems(
        fileUuids,
      );

      totalFilesDeleted += deletedCount;

      this.logger.log(
        `Processed batch: ${deletedCount} files deleted. Total: ${totalFilesDeleted}`,
      );
    }

    return {
      filesDeleted: totalFilesDeleted,
    };
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
