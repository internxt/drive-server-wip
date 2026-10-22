import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { type Job } from 'bullmq';
import { ApnRefreshProcessor } from './apn-refresh.processor';
import {
  APN_REFRESH_JOB,
  APN_REFRESH_MAX_WAIT_JOB,
  type ApnRefreshJobData,
  StorageNotificationService,
} from './storage.notifications.service';
import { newUser } from '../../../test/fixtures';

describe('ApnRefreshProcessor', () => {
  let processor: ApnRefreshProcessor;
  let storageNotificationService: DeepMocked<StorageNotificationService>;

  const user = newUser();
  const job = {
    name: APN_REFRESH_JOB,
    data: { userUuid: user.uuid },
  } as Job<ApnRefreshJobData>;
  const maxWaitJob = {
    name: APN_REFRESH_MAX_WAIT_JOB,
    data: { userUuid: user.uuid },
  } as Job<ApnRefreshJobData>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ApnRefreshProcessor],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    processor = moduleRef.get(ApnRefreshProcessor);
    storageNotificationService = moduleRef.get(StorageNotificationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('When initialized, then processor should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('When a job is processed, then it should send the APN storage notification for the job user', async () => {
      await processor.process(job);

      expect(
        storageNotificationService.getTokensAndSendApnNotification,
      ).toHaveBeenCalledWith(user.uuid);
    });

    it('When sending the notification fails, then the error should propagate so BullMQ retries', async () => {
      const error = new Error('APN unavailable');
      storageNotificationService.getTokensAndSendApnNotification.mockRejectedValueOnce(
        error,
      );

      await expect(processor.process(job)).rejects.toThrow(error);
    });

    it('When a debounced job is processed, then it should cancel the pending max wait job', async () => {
      await processor.process(job);

      expect(
        storageNotificationService.cancelApnRefreshMaxWait,
      ).toHaveBeenCalledWith(user.uuid);
    });

    it('When a max wait job is processed, then it should keep the pending debounced job', async () => {
      await processor.process(maxWaitJob);

      expect(
        storageNotificationService.getTokensAndSendApnNotification,
      ).toHaveBeenCalledWith(user.uuid);
      expect(
        storageNotificationService.cancelApnRefreshMaxWait,
      ).not.toHaveBeenCalled();
    });

    it('When sending the notification fails, then it should not cancel the max wait job', async () => {
      storageNotificationService.getTokensAndSendApnNotification.mockRejectedValueOnce(
        new Error('APN unavailable'),
      );

      await expect(processor.process(job)).rejects.toThrow();

      expect(
        storageNotificationService.cancelApnRefreshMaxWait,
      ).not.toHaveBeenCalled();
    });
  });
});
