import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { type Queue } from 'bullmq';
import {
  CleanupDeletedFilesTableScheduler,
  CLEANUP_DELETED_FILES_TABLE_QUEUE,
  CLEANUP_DELETED_FILES_TABLE_JOB_ID,
} from './cleanup-deleted-files-table.scheduler';
import { JobName } from '../../constants';

describe('CleanupDeletedFilesTableScheduler', () => {
  let scheduler: CleanupDeletedFilesTableScheduler;
  let queue: DeepMocked<Queue>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CleanupDeletedFilesTableScheduler,
        {
          provide: getQueueToken(CLEANUP_DELETED_FILES_TABLE_QUEUE),
          useValue: createMock<Queue>(),
        },
      ],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    scheduler = moduleRef.get(CleanupDeletedFilesTableScheduler);
    queue = moduleRef.get(getQueueToken(CLEANUP_DELETED_FILES_TABLE_QUEUE));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('When initialized, then service should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('scheduleCleanup', () => {
    it('When called, then it should enqueue a job with the correct job name', async () => {
      await scheduler.scheduleCleanup();

      expect(queue.add).toHaveBeenCalledWith(
        JobName.CLEANUP_DELETED_FILES_TABLE,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('When called, then it should use the fixed jobId to prevent duplicate jobs', async () => {
      await scheduler.scheduleCleanup();

      expect(queue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          jobId: CLEANUP_DELETED_FILES_TABLE_JOB_ID,
        }),
      );
    });

    it('When called, then it should configure attempts, exponential backoff, and cleanup flags', async () => {
      await scheduler.scheduleCleanup();

      expect(queue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: true,
        }),
      );
    });

    it('When queue.add throws, then the error should propagate', async () => {
      const error = new Error('Queue unavailable');
      queue.add.mockRejectedValue(error);

      await expect(scheduler.scheduleCleanup()).rejects.toThrow(error);
    });
  });
});
