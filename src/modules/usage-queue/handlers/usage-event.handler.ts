import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { type Queue } from 'bullmq';
import { type UsageInvalidatedEvent } from '../events/usage-invalidated.event';
import { USAGE_QUEUE_NAME } from '../usage-queue.module';

@Injectable()
export class UsageEventHandler {
  private readonly logger = new Logger(UsageEventHandler.name);

  constructor(
    @InjectQueue(USAGE_QUEUE_NAME) private readonly usageQueue: Queue,
  ) {}

  @OnEvent('usage.*')
  async handleUsageInvalidated(event: UsageInvalidatedEvent) {
    try {
      await this.usageQueue.add(
        'recompute',
        {
          userUuid: event.userUuid,
          userId: event.userId,
          source: event.source,
        },
        {
          jobId: event.userUuid,
          delay: 3000,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue usage recomputation for user ${event.userUuid}: ${error.message}`,
      );
    }
  }
}
