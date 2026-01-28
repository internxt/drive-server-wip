import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobName } from '../constants';
import { RedisService } from '../../../externals/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { DeleteExpiredFileVersionsAction } from '../../file/actions';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';

@Injectable()
export class DeleteExpiredFileVersionsTask {
  private readonly logger = new Logger(DeleteExpiredFileVersionsTask.name);
  private readonly lockTtl = 60 * 60 * 1000; // 1 hour
  private readonly lockKey = 'job:delete-expired-file-versions';

  constructor(
    private readonly jobExecutionRepository: SequelizeJobExecutionRepository,
    private readonly deleteExpiredFileVersionsAction: DeleteExpiredFileVersionsAction,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  @Cron('0 3 * * *', { name: JobName.EXPIRED_FILE_VERSIONS_CLEANUP })
  async scheduleExpiredVersionsCleanup() {
    const shouldExecuteCronjobs = this.configService.get<boolean>(
      'executeCronjobs',
      false,
    );

    if (!shouldExecuteCronjobs) {
      return;
    }

    await this.runJob();
  }

  async runJob() {
    this.logger.log('Starting expired file versions cleanup job');

    try {
      const lockAcquired = await this.redisService.tryAcquireLock(
        this.lockKey,
        this.lockTtl,
      );

      if (!lockAcquired) {
        this.logger.warn(
          'Lock already acquired by another instance, skipping...',
        );
        return;
      }

      this.logger.log('Lock acquired! Starting job execution');
      await this.processExpiredVersions();
    } catch (error) {
      this.logger.error(
        `Expired file versions cleanup job failed: ${error.message}`,
      );
    } finally {
      const released = await this.redisService.releaseLock(this.lockKey);
      if (released) {
        this.logger.log('Lock released successfully');
      } else {
        this.logger.warn('Lock was not released (may have expired)');
      }
    }
  }

  private async processExpiredVersions(): Promise<void> {
    const startedJob = await this.jobExecutionRepository.startJob(
      JobName.EXPIRED_FILE_VERSIONS_CLEANUP,
    );

    this.logger.log(
      `[${startedJob.id}] Starting expired file versions cleanup job`,
    );

    try {
      const result = await this.deleteExpiredFileVersionsAction.execute();

      const completedJob = await this.jobExecutionRepository.markAsCompleted(
        startedJob.id,
        {
          deletedCount: result.deletedCount,
        },
      );

      this.logger.log(
        `[${startedJob.id}] Cleanup completed at ${completedJob?.completedAt}: ${result.deletedCount} versions deleted`,
      );
    } catch (error) {
      const errorMessage = error.message;
      this.logger.error(
        `[${startedJob.id}] Error while executing expired file versions cleanup: ${errorMessage}`,
      );
      await this.jobExecutionRepository.markAsFailed(startedJob.id, {
        errorMessage,
      });
      throw error;
    }
  }
}
