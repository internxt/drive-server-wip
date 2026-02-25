import { Injectable, Logger } from '@nestjs/common';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';
import { SequelizeFolderRepository } from '../../folder/folder.repository';
import { SequelizeFileRepository } from '../../file/file.repository';
import { JobName } from '../constants';
import { Cron, CronExpression } from '@nestjs/schedule';
import { type JobExecutionModel } from '../models/job-execution.model';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../externals/redis/redis.service';

@Injectable()
export class DeletedItemsCleanupTask {
  private readonly logger = new Logger(DeletedItemsCleanupTask.name);
  private readonly lockTll = 60 * 1000; // 1 minute
  private readonly lockKey = 'cleanup:deleted-items';

  constructor(
    private readonly jobExecutionRepository: SequelizeJobExecutionRepository,
    private readonly folderRepository: SequelizeFolderRepository,
    private readonly fileRepository: SequelizeFileRepository,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES, {
    name: JobName.DELETED_ITEMS_CLEANUP,
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
        this.lockTll,
      );

      if (!acquired) {
        this.logger.log(
          'Lock already acquired by another instance, skipping...',
        );
        return;
      }

      this.logger.log('Lock acquired! Starting deleted items job');
      await this.startJob();
    } catch (error) {
      const errorObject = {
        timestamp: new Date().toISOString(),
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
      this.logger.error(
        `Deleted items cleanup job could not be setup. error: ${JSON.stringify(errorObject)}`,
      );
    }
  }

  async startJob() {
    const { startDate, untilDate, startedJob } =
      await this.initializeJobExecution();
    const jobId = startedJob.id;

    this.logger.log(
      `[${jobId}] Starting cleanup job from ${startDate} to ${untilDate}`,
    );

    try {
      this.logger.log(`[${jobId}] Phase 1: Starting to process folders`);
      const foldersWithChildrenProcessed = await this.processPhase(
        jobId,
        'FoldersPhase',
        this.yieldDeletedFoldersWithActiveChildren(startDate, untilDate, 100),
        (folderUuids) =>
          this.folderRepository.markChildFoldersAsRemoved(folderUuids),
      );

      this.logger.log(`[${jobId}] Phase 2: Starting to process files`);
      const foldersWithFilesProcessed = await this.processPhase(
        jobId,
        'FilesPhase',
        this.yieldDeletedFoldersWithActiveFiles(startDate, untilDate, 100),
        (folderUuids) =>
          this.fileRepository.markFilesInFolderAsRemoved(folderUuids),
      );

      const completedJob = await this.jobExecutionRepository.markAsCompleted(
        startedJob.id,
        {
          foldersWithChildrenProcessed,
          foldersWithFilesProcessed,
        },
      );
      this.logger.log(
        `[${jobId}] Cleanup completed at ${completedJob?.completedAt}`,
      );
    } catch (error) {
      const errorMessage = error.message;
      this.logger.error(
        `[${jobId}] Error while executing deleted folders cleanup ${errorMessage}`,
      );
      await this.jobExecutionRepository.markAsFailed(startedJob.id, {
        errorMessage,
      });
      throw error;
    }
  }

  private async processPhase(
    jobId: string | number,
    phaseName: string,
    generator: AsyncGenerator<string[], void, unknown>,
    processor: (folderUuids: string[]) => Promise<{ updatedCount: number }>,
  ) {
    let firstFolderUuid: string | null = null;
    let sameFolderRepeatedTimes = 0;
    let processedItems = 0;
    for await (const folderUuids of generator) {
      if (folderUuids.length === 0) {
        this.logger.log(`[${jobId}] No more items to process`);
        break;
      }

      if (firstFolderUuid && folderUuids.includes(firstFolderUuid)) {
        ++sameFolderRepeatedTimes;
      } else {
        sameFolderRepeatedTimes = 0;
        firstFolderUuid = folderUuids[0];
      }

      if (sameFolderRepeatedTimes >= 3) {
        this.logger.error(
          `[${jobId}] UUID ${firstFolderUuid} still present after 3 attempts while processing ${phaseName}`,
        );
        throw new Error(
          `Same folder uuid repeated more than 3 in consecutive batches during ${phaseName}`,
        );
      }

      this.logger.log(
        `[${jobId}] Deleted folders found with existent children, ${JSON.stringify({ folderUuids })}`,
      );

      const result = await processor(folderUuids);

      this.logger.log(`[${jobId}] ${result.updatedCount} children updated`);

      processedItems += folderUuids.length;
    }
    return processedItems;
  }

  async *yieldDeletedFoldersWithActiveChildren(
    startDate: Date,
    untilDate: Date,
    batchSize: number = 1000,
  ) {
    let resultCount = 0;
    do {
      const folderUuids =
        await this.folderRepository.getDeletedFoldersWithNotDeletedChildren({
          startDate,
          untilDate,
          limit: batchSize,
        });
      resultCount = folderUuids.length;

      yield folderUuids;
    } while (resultCount === batchSize);
  }

  async *yieldDeletedFoldersWithActiveFiles(
    startDate: Date,
    untilDate: Date,
    batchSize: number = 1000,
  ) {
    let resultCount = 0;
    do {
      const folderUuids =
        await this.folderRepository.getDeletedFoldersWithNotDeletedFiles({
          startDate,
          untilDate,
          limit: batchSize,
        });

      resultCount = folderUuids.length;

      yield folderUuids;
    } while (resultCount === batchSize);
  }

  async initializeJobExecution(jobMetadata?: Record<string, any>) {
    const lastCompletedJob =
      await this.jobExecutionRepository.getLastSuccessful(
        JobName.DELETED_ITEMS_CLEANUP,
      );

    const startedJob = await this.jobExecutionRepository.startJob(
      JobName.DELETED_ITEMS_CLEANUP,
      jobMetadata,
    );

    const untilDate = startedJob.startedAt;
    const startDate = this.calculateStartDate(lastCompletedJob);

    return { startDate, untilDate, startedJob };
  }

  private calculateStartDate(lastCompletedJob: JobExecutionModel | null): Date {
    if (lastCompletedJob?.startedAt) {
      return lastCompletedJob.startedAt;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    this.logger.warn(
      `No previous successful execution found. Cleanup will process items deleted from ${startOfToday}`,
    );

    return startOfToday;
  }
}
