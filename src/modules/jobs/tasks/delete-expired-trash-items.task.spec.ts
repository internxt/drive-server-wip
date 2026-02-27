import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteExpiredTrashItemsTask } from './delete-expired-trash-items.task';
import { RedisService } from '../../../externals/redis/redis.service';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';
import { SequelizeFileRepository } from '../../file/file.repository';
import { SequelizeFolderRepository } from '../../folder/folder.repository';
import { type JobExecutionModel } from '../models/job-execution.model';
import { JobName } from '../constants';

describe('DeleteExpiredTrashItemsTask', () => {
  let task: DeleteExpiredTrashItemsTask;
  let jobExecutionRepository: DeepMocked<SequelizeJobExecutionRepository>;
  let fileRepository: DeepMocked<SequelizeFileRepository>;
  let folderRepository: DeepMocked<SequelizeFolderRepository>;
  let redisService: DeepMocked<RedisService>;
  let configService: DeepMocked<ConfigService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [DeleteExpiredTrashItemsTask],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    task = moduleRef.get(DeleteExpiredTrashItemsTask);
    jobExecutionRepository = moduleRef.get(SequelizeJobExecutionRepository);
    fileRepository = moduleRef.get(SequelizeFileRepository);
    folderRepository = moduleRef.get(SequelizeFolderRepository);
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
        'cleanup:expired-trash-items',
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
      startedAt: new Date('2026-02-11T10:00:00Z'),
    } as JobExecutionModel;

    const mockCompletedJob: JobExecutionModel = {
      id: 'job-123',
      completedAt: new Date('2026-02-11T10:30:00Z'),
    } as JobExecutionModel;

    beforeEach(() => {
      jest.spyOn(task, 'initializeJobExecution').mockResolvedValue({
        lastCompletedJob: null,
        startedJob: mockStartedJob,
      });
    });

    it('When no expired items exist, then it should complete with zero deletions', async () => {
      jest
        .spyOn(task as any, 'yieldExpiredFileIds')
        .mockImplementation(async function* () {});
      jest
        .spyOn(task as any, 'yieldExpiredFolderIds')
        .mockImplementation(async function* () {});
      jobExecutionRepository.markAsCompleted.mockResolvedValue(
        mockCompletedJob,
      );

      await task.startJob();

      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        mockStartedJob.id,
        { filesDeleted: 0, foldersDeleted: 0 },
      );
    });

    it('When expired files and folders exist, then it should delete them and log counts', async () => {
      const fileIds = Array.from({ length: 100 }, (_, i) => `file-uuid-${i}`);
      const folderIds = Array.from(
        { length: 50 },
        (_, i) => `folder-uuid-${i}`,
      );

      jest
        .spyOn(task as any, 'yieldExpiredFileIds')
        .mockImplementation(async function* () {
          yield fileIds;
        });
      jest
        .spyOn(task as any, 'yieldExpiredFolderIds')
        .mockImplementation(async function* () {
          yield folderIds;
        });

      fileRepository.deleteFilesByUuid.mockResolvedValue(fileIds.length);
      folderRepository.deleteFoldersByUuid.mockResolvedValue(folderIds.length);
      jobExecutionRepository.markAsCompleted.mockResolvedValue(
        mockCompletedJob,
      );

      await task.startJob();

      expect(fileRepository.deleteFilesByUuid).toHaveBeenCalledWith(fileIds);
      expect(folderRepository.deleteFoldersByUuid).toHaveBeenCalledWith(
        folderIds,
      );
      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        mockStartedJob.id,
        { filesDeleted: 100, foldersDeleted: 50 },
      );
    });

    it('When multiple file batches exist, then it should accumulate the total count', async () => {
      const batch1 = Array.from({ length: 100 }, (_, i) => `file-uuid-${i}`);
      const batch2 = Array.from({ length: 60 }, (_, i) => `file-uuid-${i}`);

      jest
        .spyOn(task as any, 'yieldExpiredFileIds')
        .mockImplementation(async function* () {
          yield batch1;
          yield batch2;
        });
      jest
        .spyOn(task as any, 'yieldExpiredFolderIds')
        .mockImplementation(async function* () {});

      fileRepository.deleteFilesByUuid.mockResolvedValue(0);
      jobExecutionRepository.markAsCompleted.mockResolvedValue(
        mockCompletedJob,
      );

      await task.startJob();

      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        mockStartedJob.id,
        { filesDeleted: 160, foldersDeleted: 0 },
      );
    });

    it('When deletion fails, then it should mark job as failed and throw error', async () => {
      const error = new Error('Repository error');
      const fileIds = ['file-uuid-1'];

      jest
        .spyOn(task as any, 'yieldExpiredFileIds')
        .mockImplementation(async function* () {
          yield fileIds;
        });
      jest
        .spyOn(task as any, 'yieldExpiredFolderIds')
        .mockImplementation(async function* () {});

      fileRepository.deleteFilesByUuid.mockRejectedValue(error);

      await expect(task.startJob()).rejects.toThrow(error);

      expect(jobExecutionRepository.markAsFailed).toHaveBeenCalledWith(
        mockStartedJob.id,
        { errorMessage: error.message },
      );
    });
  });

  describe('initializeJobExecution', () => {
    const mockJobMetadata = { myJobData: 'value' };

    it('When last completed job is available, then it should return lastCompletedJob and startedJob', async () => {
      const lastCompletedJob: JobExecutionModel = {
        id: 'job-122',
        completedAt: new Date('2026-02-10T09:00:00Z'),
      } as JobExecutionModel;

      const newJob: JobExecutionModel = {
        id: 'job-123',
        startedAt: new Date('2026-02-11T10:00:00Z'),
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
        JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
      );
      expect(jobExecutionRepository.startJob).toHaveBeenCalledWith(
        JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
        mockJobMetadata,
      );
    });

    it('When no previous completed job is available, then it should return null for lastCompletedJob', async () => {
      const newJob: JobExecutionModel = {
        id: 'job-123',
        startedAt: new Date('2026-02-11T10:00:00Z'),
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
      expect(jobExecutionRepository.startJob).toHaveBeenCalledWith(
        JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
        undefined,
      );
    });
  });

  describe('yieldExpiredFileIds', () => {
    it('When called, then it should keep yielding file ids until there are no more to fetch', async () => {
      const batch1 = Array.from({ length: 100 }, (_, i) => `file-uuid-${i}`);
      const batch2 = Array.from({ length: 5 }, (_, i) => `file-uuid-${i}`);

      fileRepository.findExpiredTrashFileIds
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2);

      const generator = task['yieldExpiredFileIds']();
      const batches = [];
      for await (const batch of generator) {
        batches.push(batch);
      }

      expect(batches).toEqual([batch1, batch2]);
      expect(fileRepository.findExpiredTrashFileIds).toHaveBeenCalledTimes(2);
    });

    it('When batch size equals result count, then it should check for more batches', async () => {
      const batch1 = Array.from({ length: 100 }, (_, i) => `file-uuid-${i}`);

      fileRepository.findExpiredTrashFileIds
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce([]);

      const generator = task['yieldExpiredFileIds']();
      const batches = [];
      for await (const batch of generator) {
        batches.push(batch);
      }

      expect(batches).toEqual([batch1]);
      expect(fileRepository.findExpiredTrashFileIds).toHaveBeenCalledTimes(2);
    });
  });

  describe('yieldExpiredFolderIds', () => {
    it('When called, then it should keep yielding folder ids until there are no more to fetch', async () => {
      const batch1 = Array.from({ length: 100 }, (_, i) => `folder-uuid-${i}`);
      const batch2 = Array.from({ length: 5 }, (_, i) => `folder-uuid-${i}`);

      folderRepository.findExpiredTrashFolderIds
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2);

      const generator = task['yieldExpiredFolderIds']();
      const batches = [];
      for await (const batch of generator) {
        batches.push(batch);
      }

      expect(batches).toEqual([batch1, batch2]);
      expect(folderRepository.findExpiredTrashFolderIds).toHaveBeenCalledTimes(
        2,
      );
    });

    it('When batch size equals result count, then it should check for more batches', async () => {
      const batch1 = Array.from({ length: 100 }, (_, i) => `folder-uuid-${i}`);

      folderRepository.findExpiredTrashFolderIds
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce([]);

      const generator = task['yieldExpiredFolderIds']();
      const batches = [];
      for await (const batch of generator) {
        batches.push(batch);
      }

      expect(batches).toEqual([batch1]);
      expect(folderRepository.findExpiredTrashFolderIds).toHaveBeenCalledTimes(
        2,
      );
    });
  });
});
