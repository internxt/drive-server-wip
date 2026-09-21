import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { type Job } from 'bullmq';
import { ApnRefreshProcessor } from './apn-refresh.processor';
import {
  type ApnRefreshJobData,
  StorageNotificationService,
} from './storage.notifications.service';
import { newUser } from '../../../test/fixtures';

describe('ApnRefreshProcessor', () => {
  let processor: ApnRefreshProcessor;
  let storageNotificationService: DeepMocked<StorageNotificationService>;

  const user = newUser();
  const job = { data: { userUuid: user.uuid } } as Job<ApnRefreshJobData>;

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
  });
});
