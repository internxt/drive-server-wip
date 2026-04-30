import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobName } from '../../constants';
import { Time } from '../../../../lib/time';

export const DELETED_ITEMS_CLEANUP_QUEUE = 'deleted-items-cleanup';

function buildJobId(): string {
  const now = new Date();
  const date = Time.formatAsDateOnly(now);
  const hour = String(now.getUTCHours()).padStart(2, '0');
  const minutes = now.getUTCMinutes() < 30 ? '00' : '30';
  return `${date}T${hour}:${minutes}`;
}

@Injectable()
export class DeletedItemsCleanupScheduler {
  private readonly logger = new Logger(JobName.DELETED_ITEMS_CLEANUP);

  constructor(
    @InjectQueue(DELETED_ITEMS_CLEANUP_QUEUE) private readonly queue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES, {
    name: JobName.DELETED_ITEMS_CLEANUP,
  })
  async scheduleCleanup() {
    const jobId = buildJobId();
    await this.queue.add(
      JobName.DELETED_ITEMS_CLEANUP,
      {},
      {
        jobId,
        attempts: 2,
        backoff: { type: 'fixed', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.logger.log({ jobId }, 'Deleted items cleanup job enqueued.');
  }
}
