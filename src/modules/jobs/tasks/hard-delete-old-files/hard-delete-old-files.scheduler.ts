import {
  type OnApplicationBootstrap,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobName } from '../../constants';

export const HARD_DELETE_OLD_FILES_QUEUE = 'hard-delete-old-files';
export const HARD_DELETE_OLD_FILES_JOB_ID = 'hard-delete-old-files:run';

@Injectable()
export class HardDeleteOldFilesScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobName.HARD_DELETE_OLD_DELETED_FILES);

  constructor(
    @InjectQueue(HARD_DELETE_OLD_FILES_QUEUE) private readonly queue: Queue,
  ) {}

  async onApplicationBootstrap() {
    await this.scheduleCleanup();
  }

  @Cron(CronExpression.EVERY_HOUR, {
    name: JobName.HARD_DELETE_OLD_DELETED_FILES,
  })
  async scheduleCleanup() {
    await this.queue.add(
      JobName.HARD_DELETE_OLD_DELETED_FILES,
      {},
      {
        jobId: HARD_DELETE_OLD_FILES_JOB_ID,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.logger.log('Hard-delete old files job enqueued.');
  }
}
