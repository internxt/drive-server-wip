import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { type Queue } from 'bullmq';
import {
  type UsageInvalidatedEvent,
  USAGE_INVALIDATED_EVENT,
} from '../events/usage-invalidated.event';
import { USAGE_QUEUE_NAME } from '../usage-queue.constants';

const DEDUPLICATION_WINDOW_MS = 3000;

@Injectable()
export class UsageEventHandler {
  private readonly logger = new Logger(UsageEventHandler.name);

  constructor(
    @InjectQueue(USAGE_QUEUE_NAME) private readonly usageQueue: Queue,
  ) {}

  @OnEvent(USAGE_INVALIDATED_EVENT)
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
          deduplication: {
            id: event.userUuid,
            ttl: DEDUPLICATION_WINDOW_MS,
            extend: true,
          },
          delay: DEDUPLICATION_WINDOW_MS,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue usage recomputation for user ${event.userUuid}: ${error.message}`,
      );
    }
  }
}
