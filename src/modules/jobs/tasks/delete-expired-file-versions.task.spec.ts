import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteExpiredFileVersionsTask } from './delete-expired-file-versions.task';
import { RedisService } from '../../../externals/redis/redis.service';
import { DeleteExpiredFileVersionsAction } from '../../file/actions';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';
import { JobExecutionModel } from '../models/job-execution.model';
import { JobName } from '../constants';

describe('DeleteExpiredFileVersionsTask', () => {
  let task: DeleteExpiredFileVersionsTask;
  let jobExecutionRepository: DeepMocked<SequelizeJobExecutionRepository>;
  let deleteExpiredFileVersionsAction: DeepMocked<DeleteExpiredFileVersionsAction>;
  let redisService: DeepMocked<RedisService>;
  let configService: DeepMocked<ConfigService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [DeleteExpiredFileVersionsTask],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    task = moduleRef.get(DeleteExpiredFileVersionsTask);
    jobExecutionRepository = moduleRef.get(SequelizeJobExecutionRepository);
    deleteExpiredFileVersionsAction = moduleRef.get(DeleteExpiredFileVersionsAction);
    redisService = moduleRef.get(RedisService);
    configService = moduleRef.get(ConfigService);
  });

  it('When initialized, then service should be defined', () => {
    expect(task).toBeDefined();
  });

  describe('scheduleExpiredFileVersionsCleanup', () => {
    it('When executeCronjobs is false, then it should not execute the job', async () => {
      configService.get.mockReturnValue(false);
      const startJobSpy = jest.spyOn(task, 'startJob');

      await task.scheduleCleanup();

      expect(configService.get).toHaveBeenCalledWith('executeCronjobs', false);
      expect(startJobSpy).not.toHaveBeenCalled();
      expect(redisService.tryAcquireLock).not.toHaveBeenCalled();
    });

    it('When lock cannot be acquired, then it should not start the job', async () => {
      configService.get.mockReturnValue(true);
      redisService.tryAcquireLock.mockResolvedValue(false);
      const startJobSpy = jest.spyOn(task, 'startJob');

      await task.scheduleCleanup();

      expect(redisService.tryAcquireLock).toHaveBeenCalledWith(
        'cleanup:deleted-file-versions',
        60 * 1000,
      );
      expect(startJobSpy).not.toHaveBeenCalled();
    });

    it('When lock is acquired, then it should start the job', async () => {
      configService.get.mockReturnValue(true);
      redisService.tryAcquireLock.mockResolvedValue(true);
      const startJobSpy = jest.spyOn(task, 'startJob');

      await task.scheduleCleanup();

      expect(startJobSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteExpiredFileVersions', () => {
    const mockStartedJob: JobExecutionModel = {
      id: 'job-123',
      startedAt: new Date('2026-01-27T10:00:00Z'),
    } as JobExecutionModel;

    const mockCompletedJob: JobExecutionModel = {
      id: 'job-123',
      completedAt: new Date('2026-01-27T10:30:00Z'),
    } as JobExecutionModel;

    beforeEach(() => {
      jest.spyOn(task, 'initializeJobExecution').mockResolvedValue({
        lastCompletedJob: null,
        startedJob: mockStartedJob,
      });
    });

    it('When no expired versions exist, then it should complete with zero deletions', async () => {
      deleteExpiredFileVersionsAction.execute.mockResolvedValue({
        deletedCount: 0,
      });
      jobExecutionRepository.markAsCompleted.mockResolvedValue(mockCompletedJob);

      await task.startJob();

      expect(deleteExpiredFileVersionsAction.execute).toHaveBeenCalledWith();
      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        mockStartedJob.id,
        { deletedCount: 0 },
      );
    });

    it('When expired versions exist, then it should delete them and log count', async () => {
      deleteExpiredFileVersionsAction.execute.mockResolvedValue({
        deletedCount: 250,
      });
      jobExecutionRepository.markAsCompleted.mockResolvedValue(mockCompletedJob);

      await task.startJob();

      expect(deleteExpiredFileVersionsAction.execute).toHaveBeenCalledWith();
      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        mockStartedJob.id,
        { deletedCount: 250 },
      );
    });

    it('When deletion fails, then it should mark job as failed and throw error', async () => {
      const errorMessage = 'Repository error';
      const error = new Error(errorMessage);
      deleteExpiredFileVersionsAction.execute.mockRejectedValue(error);

      await expect(task.startJob()).rejects.toThrow(error);

      expect(deleteExpiredFileVersionsAction.execute).toHaveBeenCalled();
      expect(jobExecutionRepository.markAsFailed).toHaveBeenCalledWith(
        mockStartedJob.id,
        { errorMessage },
      );
    });

    it('When processing large batch, then it should handle it successfully', async () => {
      deleteExpiredFileVersionsAction.execute.mockResolvedValue({
        deletedCount: 10000,
      });
      jobExecutionRepository.markAsCompleted.mockResolvedValue(mockCompletedJob);

      await task.startJob();

      expect(deleteExpiredFileVersionsAction.execute).toHaveBeenCalledWith();
      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        mockStartedJob.id,
        { deletedCount: 10000 },
      );
    });
  });

  describe('initializeJobExecution', () => {
    const mockJobMetadata = { myJobData: 'value' };

    it('When last completed job is available, then it should return lastCompletedJob and startedJob', async () => {
      const lastCompletedJob: JobExecutionModel = {
        id: 'job-122',
        completedAt: new Date('2026-01-26T09:00:00Z'),
      } as JobExecutionModel;

      const newJob: JobExecutionModel = {
        id: 'job-123',
        startedAt: new Date('2026-01-27T10:00:00Z'),
      } as JobExecutionModel;

      jest
        .spyOn(jobExecutionRepository, 'getLastSuccessful')
        .mockResolvedValue(lastCompletedJob);
      jest.spyOn(jobExecutionRepository, 'startJob').mockResolvedValue(newJob);

      const result = await task.initializeJobExecution(mockJobMetadata);

      expect(result).toEqual({
        lastCompletedJob,
        startedJob: newJob,
      });

      expect(jobExecutionRepository.getLastSuccessful).toHaveBeenCalledWith(
        JobName.EXPIRED_FILE_VERSIONS_CLEANUP,
      );
      expect(jobExecutionRepository.startJob).toHaveBeenCalledWith(
        JobName.EXPIRED_FILE_VERSIONS_CLEANUP,
        mockJobMetadata,
      );
    });

    it('When no previous completed job is available, then it should return null for lastCompletedJob', async () => {
      const newJob: JobExecutionModel = {
        id: 'job-123',
        startedAt: new Date('2026-01-27T10:00:00Z'),
      } as JobExecutionModel;

      jest
        .spyOn(jobExecutionRepository, 'getLastSuccessful')
        .mockResolvedValue(null);
      jest.spyOn(jobExecutionRepository, 'startJob').mockResolvedValue(newJob);

      const result = await task.initializeJobExecution();

      expect(result).toEqual({
        lastCompletedJob: null,
        startedJob: newJob,
      });

      expect(jobExecutionRepository.getLastSuccessful).toHaveBeenCalledWith(
        JobName.EXPIRED_FILE_VERSIONS_CLEANUP,
      );
      expect(jobExecutionRepository.startJob).toHaveBeenCalledWith(
        JobName.EXPIRED_FILE_VERSIONS_CLEANUP,
        undefined,
      );
    });
  });
});
