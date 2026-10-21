import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { type Queue } from 'bullmq';
import {
  TrashCleanupScheduler,
  TRASH_CLEANUP_QUEUE,
  TrashCleanupItemType,
} from './trash-cleanup.scheduler';

describe('TrashCleanupScheduler', () => {
  let scheduler: TrashCleanupScheduler;
  let queue: DeepMocked<Queue>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrashCleanupScheduler,
        {
          provide: getQueueToken(TRASH_CLEANUP_QUEUE),
          useValue: createMock<Queue>(),
        },
      ],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    scheduler = moduleRef.get(TrashCleanupScheduler);
    queue = moduleRef.get(getQueueToken(TRASH_CLEANUP_QUEUE));
  });

  it('When initialized, then service should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('scheduleCleanup', () => {
    it('When called, then it should enqueue one deduplicated job per item type', async () => {
      await scheduler.scheduleCleanup();

      expect(queue.add).toHaveBeenCalledTimes(2);
      expect(queue.add).toHaveBeenCalledWith(
        'process-files',
        { itemType: TrashCleanupItemType.Files },
        expect.objectContaining({ jobId: 'trash-cleanup:files' }),
      );
      expect(queue.add).toHaveBeenCalledWith(
        'process-folders',
        { itemType: TrashCleanupItemType.Folders },
        expect.objectContaining({ jobId: 'trash-cleanup:folders' }),
      );
    });

    it('When the queue fails, then it should propagate the error', async () => {
      queue.add.mockRejectedValueOnce(new Error('Redis down'));

      await expect(scheduler.scheduleCleanup()).rejects.toThrow('Redis down');
    });
  });
});
