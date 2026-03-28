import { Test, type TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { getQueueToken } from '@nestjs/bullmq';
import { type Queue } from 'bullmq';
import { UsageEventHandler } from './usage-event.handler';
import { USAGE_QUEUE_NAME } from '../usage-queue.constants';
import { type UsageInvalidatedEvent } from '../events/usage-invalidated.event';
import { v4 } from 'uuid';

describe('UsageEventHandler', () => {
  let handler: UsageEventHandler;
  let queue: Queue;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageEventHandler,
        {
          provide: getQueueToken(USAGE_QUEUE_NAME),
          useValue: createMock<Queue>(),
        },
      ],
    }).compile();

    handler = module.get(UsageEventHandler);
    queue = module.get(getQueueToken(USAGE_QUEUE_NAME));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('When an event is received, then it should enqueue a recompute job with deduplication', async () => {
    const event: UsageInvalidatedEvent = {
      userUuid: v4(),
      userId: 1,
      source: 'file.create',
    };

    await handler.handleUsageInvalidated(event);

    expect(queue.add).toHaveBeenCalledWith(
      'recompute',
      {
        userUuid: event.userUuid,
        userId: event.userId,
        source: event.source,
      },
      {
        deduplication: {
          id: event.userUuid,
          ttl: 3000,
          extend: true,
        },
        delay: 3000,
      },
    );
  });

  it('When the queue fails to add a job, then it should not throw', async () => {
    jest.spyOn(queue, 'add').mockRejectedValue(new Error('Redis down'));

    const event: UsageInvalidatedEvent = {
      userUuid: v4(),
      userId: 1,
      source: 'file.delete',
    };

    await expect(handler.handleUsageInvalidated(event)).resolves.not.toThrow();
  });
});
