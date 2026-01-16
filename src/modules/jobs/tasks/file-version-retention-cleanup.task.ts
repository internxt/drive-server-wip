import { Injectable, Logger } from '@nestjs/common';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';
import { SequelizeFileVersionRepository } from '../../file/file-version.repository';
import { JobName } from '../constants';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../externals/redis/redis.service';
import { FileVersionStatus } from '../../file/file-version.domain';

@Injectable()
export class FileVersionRetentionCleanupTask {
  private readonly logger = new Logger(FileVersionRetentionCleanupTask.name);
  private readonly lockTTL = 10 * 60 * 1000;
  private readonly lockKey = 'cleanup:file-version-retention';

  constructor(
    private readonly jobExecutionRepository: SequelizeJobExecutionRepository,
    private readonly fileVersionRepository: SequelizeFileVersionRepository,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: JobName.FILE_VERSION_RETENTION_CLEANUP,
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
        this.lockTTL,
      );

      if (!acquired) {
        this.logger.log(
          'Lock already acquired by another instance, skipping...',
        );
        return;
      }

      this.logger.log(
        'Lock acquired! Starting file version retention cleanup job',
      );
      await this.startJob();
    } catch (error) {
      const errorObject = {
        timestamp: new Date().toISOString(),
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
      this.logger.error(
        `File version retention cleanup job could not be setup. error: ${JSON.stringify(errorObject)}`,
      );
    }
  }

  async startJob() {
    const startedJob = await this.jobExecutionRepository.startJob(
      JobName.FILE_VERSION_RETENTION_CLEANUP,
    );
    const jobId = startedJob.id;

    this.logger.log(`[${jobId}] Starting file version retention cleanup job`);

    try {
      const processedVersions = await this.processExpiredVersions(jobId);

      const completedJob = await this.jobExecutionRepository.markAsCompleted(
        startedJob.id,
        {
          processedVersions,
        },
      );

      this.logger.log(
        `[${jobId}] Cleanup completed at ${completedJob?.completedAt}. Processed ${processedVersions} versions.`,
      );
    } catch (error) {
      const errorMessage = error.message;
      this.logger.error(
        `[${jobId}] Error while executing file version retention cleanup: ${errorMessage}`,
      );
      await this.jobExecutionRepository.markAsFailed(startedJob.id, {
        errorMessage,
      });
      throw error;
    }
  }

  private async processExpiredVersions(
    jobId: string | number,
  ): Promise<number> {
    let totalProcessed = 0;
    const batchSize = 100;

    for await (const versionIds of this.yieldExpiredVersionIds(batchSize)) {
      if (versionIds.length === 0) {
        this.logger.log(`[${jobId}] No more expired versions to process`);
        break;
      }

      this.logger.log(
        `[${jobId}] Found ${versionIds.length} expired versions to mark as DELETED`,
      );

      await this.fileVersionRepository.updateStatusBatch(
        versionIds,
        FileVersionStatus.DELETED,
      );

      totalProcessed += versionIds.length;

      this.logger.log(
        `[${jobId}] Marked ${versionIds.length} versions as DELETED. Total: ${totalProcessed}`,
      );
    }

    return totalProcessed;
  }

  private async *yieldExpiredVersionIds(batchSize: number = 1000) {
    let resultCount = 0;

    do {
      const versionIds =
        await this.fileVersionRepository.findExpiredVersionIdsByRetentionPolicy(
          batchSize,
        );

      resultCount = versionIds.length;
      yield versionIds;
    } while (resultCount === batchSize);
  }
}
