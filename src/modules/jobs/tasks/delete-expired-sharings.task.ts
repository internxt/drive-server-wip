import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobName } from '../constants';
import { RedisService } from '../../../externals/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { SharingService } from '../../sharing/sharing.service';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';

@Injectable()
export class DeleteExpiredSharingsTask {
  private readonly logger = new Logger(DeleteExpiredSharingsTask.name);
  private readonly lockTll = 60 * 1000;
  private readonly lockKey = 'cleanup:expired-sharings';

  constructor(
    private readonly jobExecutionRepository: SequelizeJobExecutionRepository,
    private readonly sharingService: SharingService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES, {
    name: JobName.EXPIRED_SHARINGS_CLEANUP,
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

      this.logger.log('Lock acquired! Starting expired sharings cleanup job');
      await this.startJob();
    } catch (error) {
      this.logger.error(
        `Expired sharings cleanup job could not be setup. error: ${JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        )}`,
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
      `[${jobId}] Starting expired sharings cleanup job ${lastRun}`,
    );

    try {
      const result = await this.sharingService.deleteExpiredSharings();

      const completedJob = await this.jobExecutionRepository.markAsCompleted(
        startedJob.id,
        {
          deletedCount: result.deletedCount,
        },
      );

      this.logger.log(
        `[${jobId}] Cleanup completed at ${completedJob?.completedAt}: ${result.deletedCount} sharings deleted`,
      );
    } catch (error) {
      const errorMessage = error.message;
      this.logger.error(
        `[${jobId}] Error while executing expired sharings cleanup: ${errorMessage}`,
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
        JobName.EXPIRED_SHARINGS_CLEANUP,
      );

    const startedJob = await this.jobExecutionRepository.startJob(
      JobName.EXPIRED_SHARINGS_CLEANUP,
      jobMetadata,
    );

    return { lastCompletedJob, startedJob };
  }
}
