import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobName } from '../../constants';

export const TRASH_CLEANUP_QUEUE = 'trash-cleanup';

export enum TrashCleanupItemType {
  Files = 'files',
  Folders = 'folders',
}

@Injectable()
export class TrashCleanupScheduler {
  private readonly logger = new Logger(TrashCleanupScheduler.name);

  constructor(
    @InjectQueue(TRASH_CLEANUP_QUEUE) private readonly queue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
  })
  async scheduleCleanup() {
    const itemTypes = Object.values(TrashCleanupItemType);

    for (const itemType of itemTypes) {
      await this.queue.add(
        `process-${itemType}`,
        { itemType },
        {
          jobId: `trash-cleanup:${itemType}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    }

    this.logger.log({ itemTypes }, 'Trash cleanup jobs enqueued.');
  }
}
