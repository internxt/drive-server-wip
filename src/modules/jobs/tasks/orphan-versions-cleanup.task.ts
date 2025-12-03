import { Injectable, Logger } from '@nestjs/common';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';
import { SequelizeFileVersionRepository } from '../../file/file-version.repository';
import { JobName } from '../constants';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../externals/redis/redis.service';

@Injectable()
export class OrphanVersionsCleanupTask {
  private readonly logger = new Logger(OrphanVersionsCleanupTask.name);
  private readonly lockTtl = 60 * 1000; // 1 minute
  private readonly lockKey = 'cleanup:orphan-versions';

  constructor(
    private readonly jobExecutionRepository: SequelizeJobExecutionRepository,
    private readonly fileVersionRepository: SequelizeFileVersionRepository,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, {
    name: JobName.ORPHAN_VERSIONS_CLEANUP,
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

      this.logger.log('Lock acquired! Starting orphan versions cleanup job');
      await this.startJob();
    } catch (error) {
      const errorObject = {
        timestamp: new Date().toISOString(),
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
      this.logger.error(
        `Orphan versions cleanup job could not be setup. error: ${JSON.stringify(errorObject)}`,
      );
    }
  }

  async startJob() {
    const startedJob = await this.jobExecutionRepository.startJob(
      JobName.ORPHAN_VERSIONS_CLEANUP,
    );
    const jobId = startedJob.id;

    this.logger.log(`[${jobId}] Starting orphan versions cleanup job`);

    try {
      const orphanVersionsProcessed = await this.processOrphanVersions(jobId);

      const completedJob = await this.jobExecutionRepository.markAsCompleted(
        startedJob.id,
        {
          orphanVersionsProcessed,
        },
      );
      this.logger.log(
        `[${jobId}] Cleanup completed at ${completedJob?.completedAt}`,
      );
    } catch (error) {
      const errorMessage = error.message;
      this.logger.error(
        `[${jobId}] Error while executing orphan versions cleanup ${errorMessage}`,
      );
      await this.jobExecutionRepository.markAsFailed(startedJob.id, {
        errorMessage,
      });
      throw error;
    }
  }

  private async processOrphanVersions(jobId: string): Promise<number> {
    let processedItems = 0;
    let firstFolderUuid: string | null = null;
    let sameFolderRepeatedTimes = 0;

    for await (const folderUuids of this.yieldOrphanVersionFolderUuids(100)) {
      if (folderUuids.length === 0) {
        this.logger.log(`[${jobId}] No more orphan versions to process`);
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
          `[${jobId}] UUID ${firstFolderUuid} still present after 3 attempts`,
        );
        throw new Error(
          `Same folder uuid repeated more than 3 in consecutive batches`,
        );
      }

      this.logger.log(
        `[${jobId}] Found folders with orphan versions: ${JSON.stringify({ folderUuids })}`,
      );

      await this.fileVersionRepository.deleteAllByFolderUuids(folderUuids);

      this.logger.log(
        `[${jobId}] Marked versions as deleted for ${folderUuids.length} folders`,
      );

      processedItems += folderUuids.length;
    }

    return processedItems;
  }

  async *yieldOrphanVersionFolderUuids(batchSize: number = 100) {
    let resultCount = 0;
    do {
      const folderUuids =
        await this.fileVersionRepository.getOrphanVersionFolderUuids({
          limit: batchSize,
        });
      resultCount = folderUuids.length;

      yield folderUuids;
    } while (resultCount === batchSize);
  }
}
