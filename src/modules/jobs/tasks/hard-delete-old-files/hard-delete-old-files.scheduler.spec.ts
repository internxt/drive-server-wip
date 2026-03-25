import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { type Queue } from 'bullmq';
import {
  HardDeleteOldFilesScheduler,
  HARD_DELETE_OLD_FILES_QUEUE,
  HARD_DELETE_OLD_FILES_JOB_ID,
} from './hard-delete-old-files.scheduler';
import { JobName } from '../../constants';

describe('HardDeleteOldFilesScheduler', () => {
  let scheduler: HardDeleteOldFilesScheduler;
  let queue: DeepMocked<Queue>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HardDeleteOldFilesScheduler,
        {
          provide: getQueueToken(HARD_DELETE_OLD_FILES_QUEUE),
          useValue: createMock<Queue>(),
        },
      ],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    scheduler = moduleRef.get(HardDeleteOldFilesScheduler);
    queue = moduleRef.get(getQueueToken(HARD_DELETE_OLD_FILES_QUEUE));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('When initialized, then service should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('onApplicationBootstrap', () => {
    it('When called, then it should invoke scheduleCleanup', async () => {
      jest.spyOn(scheduler, 'scheduleCleanup').mockResolvedValue();

      await scheduler.onApplicationBootstrap();

      expect(scheduler.scheduleCleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('scheduleCleanup', () => {
    it('When called, then it should enqueue a job with the correct job name', async () => {
      await scheduler.scheduleCleanup();

      expect(queue.add).toHaveBeenCalledWith(
        JobName.HARD_DELETE_OLD_DELETED_FILES,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('When called, then it should use the fixed jobId to prevent duplicate jobs', async () => {
      await scheduler.scheduleCleanup();

      expect(queue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ jobId: HARD_DELETE_OLD_FILES_JOB_ID }),
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
