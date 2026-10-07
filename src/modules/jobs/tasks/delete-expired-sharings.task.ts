import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobName } from '../constants';
import { RedisService } from '../../../externals/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { SharingService } from '../../sharing/sharing.service';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';

const BATCH_SIZE = 100;

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
          { lockKey: this.lockKey },
          'Expired sharings cleanup lock already acquired by another instance, skipping.',
        );
        return;
      }

      await this.startJob();
    } catch (error) {
      this.logger.error(
        { error },
        'Expired sharings cleanup job could not be set up.',
      );
    }
  }

  async startJob() {
    const { lastCompletedJob, startedJob } =
      await this.initializeJobExecution();

    const jobId = startedJob.id;

    this.logger.log(
      { jobId, lastCompletedAt: lastCompletedJob?.completedAt ?? null },
      'Expired sharings cleanup started.',
    );

    try {
      let totalDeleted = 0;
      let batchNumber = 0;
      let deletedInBatch: number;

      do {
        deletedInBatch =
          await this.sharingService.deleteExpiredSharings(BATCH_SIZE);
        totalDeleted += deletedInBatch;
        batchNumber++;

        this.logger.log(
          { jobId, batchNumber, deletedInBatch, totalDeleted },
          'Expired sharings cleanup progress.',
        );
      } while (deletedInBatch === BATCH_SIZE);

      const completedJob = await this.jobExecutionRepository.markAsCompleted(
        jobId,
        { deletedCount: totalDeleted },
      );

      this.logger.log(
        {
          jobId,
          deletedCount: totalDeleted,
          completedAt: completedJob?.completedAt,
        },
        'Expired sharings cleanup completed.',
      );
    } catch (error) {
      this.logger.error({ jobId, error }, 'Expired sharings cleanup failed.');
      await this.jobExecutionRepository.markAsFailed(jobId, {
        errorMessage: error.message,
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
