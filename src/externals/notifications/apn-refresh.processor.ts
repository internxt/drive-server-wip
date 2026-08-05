import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { type Job } from 'bullmq';
import {
  APN_REFRESH_QUEUE,
  type ApnRefreshJobData,
  StorageNotificationService,
} from './storage.notifications.service';

@Processor(APN_REFRESH_QUEUE, { concurrency: 10 })
export class ApnRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(APN_REFRESH_QUEUE);

  constructor(
    private readonly storageNotificationService: StorageNotificationService,
  ) {
    super();
  }

  async process(job: Job<ApnRefreshJobData>) {
    const { userUuid } = job.data;

    try {
      await this.storageNotificationService.getTokensAndSendApnNotification(
        userUuid,
      );
    } catch (error) {
      this.logger.error(
        { userUuid, jobId: job.id, error },
        'APN refresh job failed.',
      );
      throw error;
    }
  }
}
