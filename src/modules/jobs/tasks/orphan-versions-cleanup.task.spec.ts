import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { OrphanVersionsCleanupTask } from './orphan-versions-cleanup.task';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';
import { SequelizeFileVersionRepository } from '../../file/file-version.repository';
import { JobExecutionModel } from '../models/job-execution.model';
import { v4 } from 'uuid';
import { RedisService } from '../../../externals/redis/redis.service';

describe('OrphanVersionsCleanupTask', () => {
  let task: OrphanVersionsCleanupTask;
  let jobExecutionRepository: DeepMocked<SequelizeJobExecutionRepository>;
  let fileVersionRepository: DeepMocked<SequelizeFileVersionRepository>;
  let redisService: DeepMocked<RedisService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [OrphanVersionsCleanupTask],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    task = moduleRef.get(OrphanVersionsCleanupTask);
    jobExecutionRepository = moduleRef.get(SequelizeJobExecutionRepository);
    fileVersionRepository = moduleRef.get(SequelizeFileVersionRepository);
    redisService = moduleRef.get(RedisService);
  });

  it('When initialized, then service should be defined', () => {
    expect(task).toBeDefined();
  });

  describe('scheduleCleanup', () => {
    it('When lock cannot be acquired, it should not start the job', async () => {
      jest.spyOn(redisService, 'tryAcquireLock').mockResolvedValue(false);
      const startJobSpy = jest.spyOn(task, 'startJob');

      await task.scheduleCleanup();

      expect(startJobSpy).not.toHaveBeenCalled();
    });

    it('When lock is acquired, it should start the job', async () => {
      jest.spyOn(redisService, 'tryAcquireLock').mockResolvedValue(true);
      const startJobSpy = jest.spyOn(task, 'startJob').mockResolvedValue();

      await task.scheduleCleanup();

      expect(startJobSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('startJob', () => {
    const mockStartedJob: JobExecutionModel = {
      id: 'job-123',
      startedAt: new Date('2025-01-01T10:00:00Z'),
    } as JobExecutionModel;

    const mockCompletedJob: JobExecutionModel = {
      id: 'job-123',
      completedAt: new Date('2025-01-01T10:30:00Z'),
    } as JobExecutionModel;

    beforeEach(() => {
      jobExecutionRepository.startJob.mockResolvedValue(mockStartedJob);
    });

    it('When orphan versions are found and processed, then it should mark the job as completed', async () => {
      const folderUuids = [v4(), v4()];

      jest
        .spyOn(task, 'yieldOrphanVersionFolderUuids')
        .mockImplementation(async function* () {
          yield folderUuids;
          yield [];
        });

      fileVersionRepository.deleteAllByFolderUuids.mockResolvedValue(undefined);
      jobExecutionRepository.markAsCompleted.mockResolvedValue(
        mockCompletedJob,
      );

      await task.startJob();

      expect(fileVersionRepository.deleteAllByFolderUuids).toHaveBeenCalledWith(
        folderUuids,
      );
      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        mockStartedJob.id,
        {
          orphanVersionsProcessed: 2,
        },
      );
    });

    it('When no orphan versions are found, then it should complete with zero processed', async () => {
      jest
        .spyOn(task, 'yieldOrphanVersionFolderUuids')
        .mockImplementation(async function* () {
          yield [];
        });

      jobExecutionRepository.markAsCompleted.mockResolvedValue(
        mockCompletedJob,
      );

      await task.startJob();

      expect(
        fileVersionRepository.deleteAllByFolderUuids,
      ).not.toHaveBeenCalled();
      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        mockStartedJob.id,
        {
          orphanVersionsProcessed: 0,
        },
      );
    });

    it('When error occurs, then it should mark the job as failed', async () => {
      const errorMessage = 'Database connection failed';
      const error = new Error(errorMessage);

      jest
        .spyOn(task, 'yieldOrphanVersionFolderUuids')
        .mockImplementation(async function* () {
          yield [v4()];
        });

      fileVersionRepository.deleteAllByFolderUuids.mockRejectedValue(error);

      await expect(task.startJob()).rejects.toThrow(error);

      expect(jobExecutionRepository.markAsFailed).toHaveBeenCalledWith(
        mockStartedJob.id,
        {
          errorMessage: errorMessage,
        },
      );
    });

    it('When same folder appears more than 3 times consecutively, then it should throw error', async () => {
      const repeatedFolderUuid = v4();

      jest
        .spyOn(task, 'yieldOrphanVersionFolderUuids')
        .mockImplementation(async function* () {
          yield [repeatedFolderUuid];
          yield [repeatedFolderUuid];
          yield [repeatedFolderUuid];
          yield [repeatedFolderUuid];
        });

      fileVersionRepository.deleteAllByFolderUuids.mockResolvedValue(undefined);

      await expect(task.startJob()).rejects.toThrow(
        'Same folder uuid repeated more than 3 in consecutive batches',
      );

      expect(jobExecutionRepository.markAsFailed).toHaveBeenCalled();
    });
  });

  describe('yieldOrphanVersionFolderUuids', () => {
    it('When called, then it should keep yielding folders until there are no more folders to fetch', async () => {
      const folderUuids = [v4(), v4(), v4()];

      jest
        .spyOn(fileVersionRepository, 'getOrphanVersionFolderUuids')
        .mockResolvedValueOnce([folderUuids[0], folderUuids[1]])
        .mockResolvedValueOnce([folderUuids[2]]);

      const generator = task.yieldOrphanVersionFolderUuids(2);

      const batches = [];
      for await (const batch of generator) {
        batches.push(batch);
      }

      expect(batches).toEqual([
        [folderUuids[0], folderUuids[1]],
        [folderUuids[2]],
      ]);

      expect(
        fileVersionRepository.getOrphanVersionFolderUuids,
      ).toHaveBeenCalledTimes(2);
    });

    it('When repository returns empty array, then it should stop yielding', async () => {
      jest
        .spyOn(fileVersionRepository, 'getOrphanVersionFolderUuids')
        .mockResolvedValueOnce([]);

      const generator = task.yieldOrphanVersionFolderUuids(100);

      const batches = [];
      for await (const batch of generator) {
        batches.push(batch);
      }

      expect(batches).toEqual([[]]);
      expect(
        fileVersionRepository.getOrphanVersionFolderUuids,
      ).toHaveBeenCalledTimes(1);
    });
  });
});
