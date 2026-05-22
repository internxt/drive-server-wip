import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { type Queue } from 'bullmq';
import {
  DeletedItemsCleanupScheduler,
  DELETED_ITEMS_CLEANUP_QUEUE,
} from './deleted-items-cleanup.scheduler';
import { JobName } from '../../constants';

describe('DeletedItemsCleanupScheduler', () => {
  let scheduler: DeletedItemsCleanupScheduler;
  let queue: DeepMocked<Queue>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DeletedItemsCleanupScheduler,
        {
          provide: getQueueToken(DELETED_ITEMS_CLEANUP_QUEUE),
          useValue: createMock<Queue>(),
        },
      ],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    scheduler = moduleRef.get(DeletedItemsCleanupScheduler);
    queue = moduleRef.get(getQueueToken(DELETED_ITEMS_CLEANUP_QUEUE));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('scheduleCleanup', () => {
    it('When called, then it should enqueue a job with the correct job name', async () => {
      await scheduler.scheduleCleanup();

      expect(queue.add).toHaveBeenCalledWith(
        JobName.DELETED_ITEMS_CLEANUP,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('When called, then it should use a date-stamped jobId to prevent duplicate jobs', async () => {
      const FROZEN_NOW = new Date('2026-04-30T14:45:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(FROZEN_NOW);

      await scheduler.scheduleCleanup();

      expect(queue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ jobId: '2026-04-30T1430' }),
      );

      jest.useRealTimers();
    });

    it('When called, then it should configure attempts, fixed backoff, and cleanup flags', async () => {
      await scheduler.scheduleCleanup();

      expect(queue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          attempts: 2,
          backoff: { type: 'fixed', delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: true,
        }),
      );
    });
  });
});
