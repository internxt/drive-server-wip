import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobName } from '../../constants';

export const CLEANUP_DELETED_FILES_TABLE_QUEUE =
  'cleanup-deleted-files-table';
export const CLEANUP_DELETED_FILES_TABLE_JOB_ID =
  'cleanup-deleted-files-table-id';

@Injectable()
export class CleanupDeletedFilesTableScheduler {
  private readonly logger = new Logger(
    JobName.CLEANUP_DELETED_FILES_TABLE,
  );

  constructor(
    @InjectQueue(CLEANUP_DELETED_FILES_TABLE_QUEUE)
    private readonly queue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_12_HOURS, {
    name: JobName.CLEANUP_DELETED_FILES_TABLE,
  })
  async scheduleCleanup() {
    await this.queue.add(
      JobName.CLEANUP_DELETED_FILES_TABLE,
      {},
      {
        jobId: CLEANUP_DELETED_FILES_TABLE_JOB_ID,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.logger.log('Hard-delete old deleted_files_new job enqueued.');
  }
}
