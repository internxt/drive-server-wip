import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileVersionRetentionCleanupTask } from './file-version-retention-cleanup.task';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';
import { SequelizeFileVersionRepository } from '../../file/file-version.repository';
import { RedisService } from '../../../externals/redis/redis.service';
import { JobExecutionModel } from '../models/job-execution.model';
import { FileVersionStatus } from '../../file/file-version.domain';

describe('FileVersionRetentionCleanupTask', () => {
  let task: FileVersionRetentionCleanupTask;
  let jobExecutionRepository: DeepMocked<SequelizeJobExecutionRepository>;
  let fileVersionRepository: DeepMocked<SequelizeFileVersionRepository>;
  let redisService: DeepMocked<RedisService>;
  let configService: DeepMocked<ConfigService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [FileVersionRetentionCleanupTask],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    task = moduleRef.get(FileVersionRetentionCleanupTask);
    jobExecutionRepository = moduleRef.get(SequelizeJobExecutionRepository);
    fileVersionRepository = moduleRef.get(SequelizeFileVersionRepository);
    redisService = moduleRef.get(RedisService);
    configService = moduleRef.get(ConfigService);
  });

  it('When initialized, then service should be defined', () => {
    expect(task).toBeDefined();
  });

  describe('scheduleCleanup', () => {
    it('When executeCronjobs is false, then it should not start the job', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(false);
      const startJobSpy = jest.spyOn(task, 'startJob');

      await task.scheduleCleanup();

      expect(configService.get).toHaveBeenCalledWith('executeCronjobs', false);
      expect(startJobSpy).not.toHaveBeenCalled();
    });

    it('When lock cannot be acquired, then it should not start the job', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(true);
      jest.spyOn(redisService, 'tryAcquireLock').mockResolvedValue(false);
      const startJobSpy = jest.spyOn(task, 'startJob');

      await task.scheduleCleanup();

      expect(startJobSpy).not.toHaveBeenCalled();
    });

    it('When lock is acquired, then it should start the job', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(true);
      jest.spyOn(redisService, 'tryAcquireLock').mockResolvedValue(true);
      const startJobSpy = jest.spyOn(task, 'startJob').mockResolvedValue();

      await task.scheduleCleanup();

      expect(startJobSpy).toHaveBeenCalledTimes(1);
    });

    it('When error occurs acquiring lock, then it should log error', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(true);
      const error = new Error('Redis connection failed');
      jest.spyOn(redisService, 'tryAcquireLock').mockRejectedValue(error);

      await task.scheduleCleanup();

      expect(redisService.tryAcquireLock).toHaveBeenCalled();
    });
  });

  describe('startJob', () => {
    const mockStartedJob: JobExecutionModel = {
      id: 'job-123',
      startedAt: new Date('2025-01-01T10:00:00Z'),
    } as JobExecutionModel;

    const mockCompletedJob: JobExecutionModel = {
      id: 'job-123',
      completedAt: new Date('2025-01-01T10:01:00Z'),
    } as JobExecutionModel;

    beforeEach(() => {
      jobExecutionRepository.startJob.mockResolvedValue(mockStartedJob);
    });

    it('When no expired versions exist, then it should complete with 0 processed', async () => {
      fileVersionRepository.findExpiredVersionIdsByRetentionPolicy.mockResolvedValue(
        [],
      );
      jobExecutionRepository.markAsCompleted.mockResolvedValue(
        mockCompletedJob,
      );

      await task.startJob();

      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        'job-123',
        { processedVersions: 0 },
      );
    });

    it('When expired versions exist, then it should process them in batches', async () => {
      const batch1 = Array.from({ length: 100 }, (_, i) => `version-${i}`);
      const batch2 = Array.from(
        { length: 100 },
        (_, i) => `version-${i + 100}`,
      );
      const batch3 = Array.from({ length: 50 }, (_, i) => `version-${i + 200}`);

      fileVersionRepository.findExpiredVersionIdsByRetentionPolicy
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce(batch3);

      jobExecutionRepository.markAsCompleted.mockResolvedValue(
        mockCompletedJob,
      );

      await task.startJob();

      expect(
        fileVersionRepository.findExpiredVersionIdsByRetentionPolicy,
      ).toHaveBeenCalledTimes(3);
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenCalledTimes(3);
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenCalledWith(
        batch1,
        FileVersionStatus.DELETED,
      );
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenCalledWith(
        batch2,
        FileVersionStatus.DELETED,
      );
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenCalledWith(
        batch3,
        FileVersionStatus.DELETED,
      );
      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        'job-123',
        { processedVersions: 250 },
      );
    });

    it('When single batch exists, then it should process and stop', async () => {
      const batch = Array.from({ length: 50 }, (_, i) => `version-${i}`);

      fileVersionRepository.findExpiredVersionIdsByRetentionPolicy.mockResolvedValueOnce(
        batch,
      );

      jobExecutionRepository.markAsCompleted.mockResolvedValue(
        mockCompletedJob,
      );

      await task.startJob();

      expect(
        fileVersionRepository.findExpiredVersionIdsByRetentionPolicy,
      ).toHaveBeenCalledTimes(1);
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenCalledTimes(1);
      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        'job-123',
        { processedVersions: 50 },
      );
    });

    it('When processing fails, then it should mark job as failed', async () => {
      const error = new Error('Database error');

      fileVersionRepository.findExpiredVersionIdsByRetentionPolicy.mockRejectedValue(
        error,
      );

      await expect(task.startJob()).rejects.toThrow(error);

      expect(jobExecutionRepository.markAsFailed).toHaveBeenCalledWith(
        'job-123',
        { errorMessage: 'Database error' },
      );
    });

    it('When updateStatusBatch fails, then it should mark job as failed', async () => {
      const batch = ['version-1', 'version-2'];
      const error = new Error('Update failed');

      fileVersionRepository.findExpiredVersionIdsByRetentionPolicy.mockResolvedValue(
        batch,
      );
      fileVersionRepository.updateStatusBatch.mockRejectedValue(error);

      await expect(task.startJob()).rejects.toThrow(error);

      expect(jobExecutionRepository.markAsFailed).toHaveBeenCalledWith(
        'job-123',
        { errorMessage: 'Update failed' },
      );
    });

    it('When batch size is 100, then it should query with limit 100', async () => {
      fileVersionRepository.findExpiredVersionIdsByRetentionPolicy.mockResolvedValue(
        [],
      );
      jobExecutionRepository.markAsCompleted.mockResolvedValue(
        mockCompletedJob,
      );

      await task.startJob();

      expect(
        fileVersionRepository.findExpiredVersionIdsByRetentionPolicy,
      ).toHaveBeenCalledWith(100);
    });
  });
});
