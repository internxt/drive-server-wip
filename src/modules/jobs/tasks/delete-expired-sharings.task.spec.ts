import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteExpiredSharingsTask } from './delete-expired-sharings.task';
import { RedisService } from '../../../externals/redis/redis.service';
import { SharingService } from '../../sharing/sharing.service';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';
import { type JobExecutionModel } from '../models/job-execution.model';
import { JobName } from '../constants';

describe('DeleteExpiredSharingsTask', () => {
  let task: DeleteExpiredSharingsTask;
  let jobExecutionRepository: DeepMocked<SequelizeJobExecutionRepository>;
  let sharingService: DeepMocked<SharingService>;
  let redisService: DeepMocked<RedisService>;
  let configService: DeepMocked<ConfigService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [DeleteExpiredSharingsTask],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    task = moduleRef.get(DeleteExpiredSharingsTask);
    jobExecutionRepository = moduleRef.get(SequelizeJobExecutionRepository);
    sharingService = moduleRef.get(SharingService);
    redisService = moduleRef.get(RedisService);
    configService = moduleRef.get(ConfigService);
  });

  it('When initialized, then service should be defined', () => {
    expect(task).toBeDefined();
  });

  describe('scheduleCleanup', () => {
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
        'cleanup:expired-sharings',
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

  describe('startJob', () => {
    const mockStartedJob: JobExecutionModel = {
      id: 'job-123',
      startedAt: new Date('2026-10-01T10:00:00Z'),
    } as JobExecutionModel;

    const mockCompletedJob: JobExecutionModel = {
      id: 'job-123',
      completedAt: new Date('2026-10-01T10:30:00Z'),
    } as JobExecutionModel;

    beforeEach(() => {
      jest.spyOn(task, 'initializeJobExecution').mockResolvedValue({
        lastCompletedJob: null,
        startedJob: mockStartedJob,
      });
    });

    it('When no expired sharings exist, then it should complete with zero deletions', async () => {
      sharingService.deleteExpiredSharings.mockResolvedValue({
        deletedCount: 0,
      });
      jobExecutionRepository.markAsCompleted.mockResolvedValue(
        mockCompletedJob,
      );

      await task.startJob();

      expect(sharingService.deleteExpiredSharings).toHaveBeenCalledWith();
      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        mockStartedJob.id,
        { deletedCount: 0 },
      );
    });

    it('When expired sharings exist, then it should delete them and save the count', async () => {
      sharingService.deleteExpiredSharings.mockResolvedValue({
        deletedCount: 42,
      });
      jobExecutionRepository.markAsCompleted.mockResolvedValue(
        mockCompletedJob,
      );

      await task.startJob();

      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        mockStartedJob.id,
        { deletedCount: 42 },
      );
    });

    it('When deletion fails, then it should mark job as failed and throw error', async () => {
      const errorMessage = 'Repository error';
      const error = new Error(errorMessage);
      sharingService.deleteExpiredSharings.mockRejectedValue(error);

      await expect(task.startJob()).rejects.toThrow(error);

      expect(jobExecutionRepository.markAsFailed).toHaveBeenCalledWith(
        mockStartedJob.id,
        { errorMessage },
      );
    });
  });

  describe('initializeJobExecution', () => {
    it('When called, then it uses the expired sharings cleanup job name', async () => {
      const newJob: JobExecutionModel = {
        id: 'job-123',
        startedAt: new Date('2026-10-01T10:00:00Z'),
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
        JobName.EXPIRED_SHARINGS_CLEANUP,
      );
      expect(jobExecutionRepository.startJob).toHaveBeenCalledWith(
        JobName.EXPIRED_SHARINGS_CLEANUP,
        undefined,
      );
    });
  });
});
