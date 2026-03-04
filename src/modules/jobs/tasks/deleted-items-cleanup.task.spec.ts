import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { DeletedItemsCleanupTask } from './deleted-items-cleanup.task';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';
import { SequelizeFolderRepository } from '../../folder/folder.repository';
import { JobName } from '../constants';
import { type JobExecutionModel } from '../models/job-execution.model';
import { v4 } from 'uuid';
import { RedisService } from '../../../externals/redis/redis.service';

describe('DeletedItemsCleanupTask', () => {
  let task: DeletedItemsCleanupTask;
  let jobExecutionRepository: DeepMocked<SequelizeJobExecutionRepository>;
  let folderRepository: DeepMocked<SequelizeFolderRepository>;
  let redisService: DeepMocked<RedisService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [DeletedItemsCleanupTask],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    task = moduleRef.get(DeletedItemsCleanupTask);
    jobExecutionRepository = moduleRef.get(SequelizeJobExecutionRepository);
    folderRepository = moduleRef.get(SequelizeFolderRepository);
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
      const startJobSpy = jest.spyOn(task, 'startJob');

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
      jest.spyOn(task, 'initializeJobExecution').mockResolvedValue({
        startDate: new Date('2025-01-01T00:00:00Z'),
        untilDate: new Date('2025-01-01T10:00:00Z'),
        startedJob: mockStartedJob,
      });
    });

    it('When both phases succeed, then it should mark the job as completed', async () => {
      const foldersWithRemainingFolders = 10;
      const foldersWithRemainingFiles = 5;

      jest
        .spyOn(task as any, 'processPhase')
        .mockResolvedValueOnce(foldersWithRemainingFolders)
        .mockResolvedValueOnce(foldersWithRemainingFiles);

      jobExecutionRepository.markAsCompleted.mockResolvedValue(
        mockCompletedJob,
      );

      await task.startJob();

      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        expect.any(String),
        {
          foldersWithChildrenProcessed: foldersWithRemainingFolders,
          foldersWithFilesProcessed: foldersWithRemainingFiles,
        },
      );
    });

    it('When error occurs, then it should mark the job as failed', async () => {
      const errorMessage = 'Database connection failed';
      const error = new Error(errorMessage);
      jest.spyOn(task as any, 'processPhase').mockRejectedValue(error);

      await expect(task.startJob()).rejects.toThrow(error);

      expect(jobExecutionRepository.markAsFailed).toHaveBeenCalledWith(
        expect.any(String),
        {
          errorMessage: errorMessage,
        },
      );
    });
  });

  describe('processPhase', () => {
    it('When same folder appears more than 3 times consecutively,then it should throw error', async () => {
      const mockGenerator = (async function* () {
        yield ['folder-1'];
        yield ['folder-1'];
        yield ['folder-1'];
        yield ['folder-1'];
      })();

      const mockProcessor = jest.fn().mockResolvedValue({ updatedCount: 4 });

      await expect(
        task['processPhase'](
          'job-123',
          'TestPhase',
          mockGenerator,
          mockProcessor,
        ),
      ).rejects.toThrow(
        'Same folder uuid repeated more than 3 in consecutive batches during TestPhase',
      );
    });

    it('When different folder appears, then it should reset counter', async () => {
      const mockGenerator = (async function* () {
        yield ['folder-1'];
        yield ['folder-1'];
        yield ['folder-2']; // Different folder resets counter
        yield ['folder-1'];
        yield [];
      })();

      const mockProcessor = jest.fn().mockResolvedValue({ updatedCount: 4 });

      const result = await task['processPhase'](
        'job-123',
        'TestPhase',
        mockGenerator,
        mockProcessor,
      );

      expect(result).toBe(4);
      expect(mockProcessor).toHaveBeenCalledTimes(4);
    });
  });

  describe('yieldDeletedFoldersWithActiveChildren', () => {
    it('When called, then it should keep yielding folders until there are no more folders to fetch', async () => {
      const startDate = new Date('2025-01-01');
      const untilDate = new Date('2025-01-02');

      const folderUuids = [v4(), v4(), v4()];
      jest
        .spyOn(folderRepository, 'getDeletedFoldersWithNotDeletedChildren')
        .mockResolvedValueOnce([folderUuids[0], folderUuids[1]])
        .mockResolvedValueOnce([folderUuids[2]]);

      const generator = task.yieldDeletedFoldersWithActiveChildren(
        startDate,
        untilDate,
        2,
      );

      const batches = [];
      for await (const batch of generator) {
        batches.push(batch);
      }

      expect(batches).toEqual([
        [folderUuids[0], folderUuids[1]],
        [folderUuids[2]],
      ]);

      expect(
        folderRepository.getDeletedFoldersWithNotDeletedChildren,
      ).toHaveBeenCalledTimes(2);
    });
  });

  describe('yieldDeletedFoldersWithActiveFiles', () => {
    it('When called, then it should keep yielding folders until there are no more folders to fetch', async () => {
      const startDate = new Date('2025-01-01');
      const untilDate = new Date('2025-01-02');
      const folderUuids = [v4()];

      jest
        .spyOn(folderRepository, 'getDeletedFoldersWithNotDeletedFiles')
        .mockResolvedValueOnce([folderUuids[0]])
        .mockResolvedValueOnce([]);

      const generator = task.yieldDeletedFoldersWithActiveFiles(
        startDate,
        untilDate,
        1,
      );

      const batches = [];
      for await (const batch of generator) {
        batches.push(batch);
      }

      expect(batches).toEqual([[folderUuids[0]], []]);
    });
  });

  describe('initializeJobExecution', () => {
    const mockJobMetadata = { myJobData: 'value' };

    it('When last completed job is available, then it should use the started date as start date to fetch deleted folders', async () => {
      const lastCompletedJob: JobExecutionModel = {
        startedAt: new Date('2024-12-31T09:00:00Z'),
      } as JobExecutionModel;

      const newJob: JobExecutionModel = {
        id: 'job-456',
        startedAt: new Date('2025-01-01T10:00:00Z'),
      } as JobExecutionModel;

      jest
        .spyOn(jobExecutionRepository, 'getLastSuccessful')
        .mockResolvedValue(lastCompletedJob);
      jest.spyOn(jobExecutionRepository, 'startJob').mockResolvedValue(newJob);

      const result = await task.initializeJobExecution(mockJobMetadata);

      expect(result).toEqual({
        startDate: lastCompletedJob.startedAt,
        untilDate: newJob.startedAt,
        startedJob: newJob,
      });

      expect(jobExecutionRepository.getLastSuccessful).toHaveBeenCalledWith(
        JobName.DELETED_ITEMS_CLEANUP,
      );
      expect(jobExecutionRepository.startJob).toHaveBeenCalledWith(
        JobName.DELETED_ITEMS_CLEANUP,
        mockJobMetadata,
      );
    });

    it('When no previous completed job is available, then it should use todays date at 00:00 as start date to fetch deleted folders', async () => {
      const mockCurrentTime = new Date('2025-01-01T15:30:00Z');

      const expectedStartOfDay = new Date(mockCurrentTime);
      expectedStartOfDay.setHours(0, 0, 0, 0);

      jest.useFakeTimers();
      jest.setSystemTime(mockCurrentTime);

      const newJob: JobExecutionModel = {
        id: v4(),
        startedAt: mockCurrentTime,
      } as JobExecutionModel;

      jest
        .spyOn(jobExecutionRepository, 'getLastSuccessful')
        .mockResolvedValue(null);
      jest.spyOn(jobExecutionRepository, 'startJob').mockResolvedValue(newJob);

      const result = await task.initializeJobExecution();

      expect(result.startDate).toEqual(expectedStartOfDay);
      expect(result.untilDate).toEqual(mockCurrentTime);
      expect(result.startedJob).toEqual(newJob);

      jest.useRealTimers();
    });
  });
});
