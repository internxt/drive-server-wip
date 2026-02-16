import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteExpiredTrashItemsTask } from './delete-expired-trash-items.task';
import { RedisService } from '../../../externals/redis/redis.service';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';
import { SequelizeTrashRepository } from '../../trash/trash.repository';
import { TrashUseCases } from '../../trash/trash.usecase';
import { JobExecutionModel } from '../models/job-execution.model';
import { JobName } from '../constants';
import { Trash } from '../../trash/trash.domain';
import { TrashItemType } from '../../trash/trash.attributes';

describe('DeleteExpiredTrashItemsTask', () => {
  let task: DeleteExpiredTrashItemsTask;
  let jobExecutionRepository: DeepMocked<SequelizeJobExecutionRepository>;
  let trashRepository: DeepMocked<SequelizeTrashRepository>;
  let trashUseCases: DeepMocked<TrashUseCases>;
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
    trashRepository = moduleRef.get(SequelizeTrashRepository);
    trashUseCases = moduleRef.get(TrashUseCases);
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
      jest.spyOn(task as any, 'yieldExpiredTrashItems').mockImplementation(async function* () {
        yield [];
      });
      jobExecutionRepository.markAsCompleted.mockResolvedValue(
        mockCompletedJob,
      );

      await task.startJob();

      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        mockStartedJob.id,
        {
          filesDeleted: 0,
          foldersDeleted: 0,
        },
      );
    });

    it('When expired items exist, then it should delete them and log counts', async () => {
      const batch1 = Array.from({ length: 100 }, (_, i) =>
        Trash.build({
          itemId: `file-${i}`,
          itemType: TrashItemType.File,
          caducityDate: new Date('2026-01-01'),
          userId: 1,
        }),
      );
      const batch2 = Array.from({ length: 50 }, (_, i) =>
        Trash.build({
          itemId: `folder-${i}`,
          itemType: TrashItemType.Folder,
          caducityDate: new Date('2026-01-01'),
          userId: 1,
        }),
      );

      jest.spyOn(task as any, 'yieldExpiredTrashItems').mockImplementation(async function* () {
        yield batch1;
        yield batch2;
      });

      trashUseCases.deleteExpiredItems
        .mockResolvedValueOnce({ filesDeleted: 100, foldersDeleted: 0 })
        .mockResolvedValueOnce({ filesDeleted: 50, foldersDeleted: 25 });

      jobExecutionRepository.markAsCompleted.mockResolvedValue(
        mockCompletedJob,
      );

      await task.startJob();

      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        mockStartedJob.id,
        {
          filesDeleted: 150,
          foldersDeleted: 25,
        },
      );
    });

    it('When deletion fails, then it should mark job as failed and throw error', async () => {
      const errorMessage = 'Repository error';
      const error = new Error(errorMessage);
      const batch = [
        Trash.build({
          itemId: 'file-1',
          itemType: TrashItemType.File,
          caducityDate: new Date('2026-01-01'),
          userId: 1,
        }),
      ];

      jest.spyOn(task as any, 'yieldExpiredTrashItems').mockImplementation(async function* () {
        yield batch;
      });
      trashUseCases.deleteExpiredItems.mockRejectedValue(error);

      await expect(task.startJob()).rejects.toThrow(error);

      expect(jobExecutionRepository.markAsFailed).toHaveBeenCalledWith(
        mockStartedJob.id,
        { errorMessage },
      );
    });

    it('When processing large batch, then it should handle it successfully', async () => {
      const largeBatch = Array.from({ length: 100 }, (_, i) =>
        Trash.build({
          itemId: `item-${i}`,
          itemType: i % 2 === 0 ? TrashItemType.File : TrashItemType.Folder,
          caducityDate: new Date('2026-01-01'),
          userId: 1,
        }),
      );

      jest.spyOn(task as any, 'yieldExpiredTrashItems').mockImplementation(async function* () {
        for (let i = 0; i < 50; i++) {
          yield largeBatch;
        }
      });

      trashUseCases.deleteExpiredItems.mockResolvedValue({
        filesDeleted: 100,
        foldersDeleted: 20,
      });

      jobExecutionRepository.markAsCompleted.mockResolvedValue(
        mockCompletedJob,
      );

      await task.startJob();

      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        mockStartedJob.id,
        {
          filesDeleted: 5000,
          foldersDeleted: 1000,
        },
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

      expect(jobExecutionRepository.getLastSuccessful).toHaveBeenCalledWith(
        JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
      );
      expect(jobExecutionRepository.startJob).toHaveBeenCalledWith(
        JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
        undefined,
      );
    });
  });

  describe('yieldExpiredTrashItems', () => {
    it('When called, then it should keep yielding items until there are no more items to fetch', async () => {
      const batch1 = Array.from({ length: 10 }, (_, i) =>
        Trash.build({
          itemId: `file-${i}`,
          itemType: TrashItemType.File,
          caducityDate: new Date('2026-01-01'),
          userId: 1,
        }),
      );

      const batch2 = Array.from({ length: 5 }, (_, i) =>
        Trash.build({
          itemId: `folder-${i}`,
          itemType: TrashItemType.Folder,
          caducityDate: new Date('2026-01-01'),
          userId: 1,
        }),
      );

      trashRepository.findExpiredItems
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2);

      const generator = task['yieldExpiredTrashItems'](10);

      const batches = [];
      for await (const batch of generator) {
        batches.push(batch);
      }

      expect(batches).toEqual([batch1, batch2]);
      expect(trashRepository.findExpiredItems).toHaveBeenCalledTimes(2);
    });

    it('When batch size equals result count, then it should check for more batches', async () => {
      const batch1 = Array.from({ length: 100 }, (_, i) =>
        Trash.build({
          itemId: `file-${i}`,
          itemType: TrashItemType.File,
          caducityDate: new Date('2026-01-01'),
          userId: 1,
        }),
      );

      trashRepository.findExpiredItems
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce([]);

      const generator = task['yieldExpiredTrashItems'](100);

      const batches = [];
      for await (const batch of generator) {
        batches.push(batch);
      }

      expect(batches).toEqual([batch1]);
      expect(trashRepository.findExpiredItems).toHaveBeenCalledTimes(2);
    });
  });
});
