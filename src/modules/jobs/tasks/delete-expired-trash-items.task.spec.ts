import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteExpiredTrashItemsTask } from './delete-expired-trash-items.task';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';
import { SequelizeFileRepository } from '../../file/file.repository';
import { SequelizeFolderRepository } from '../../folder/folder.repository';
import { SequelizeFeatureLimitsRepository } from '../../feature-limit/feature-limit.repository';
import { type JobExecutionModel } from '../models/job-execution.model';
import { JobName } from '../constants';
import { Time } from '../../../lib/time';

jest.mock('newrelic', () => ({
  startBackgroundTransaction: jest.fn((_name, _group, cb) => cb()),
  getTransaction: jest.fn(() => ({ end: jest.fn() })),
  noticeError: jest.fn(),
  addCustomAttribute: jest.fn(),
}));

describe('DeleteExpiredTrashItemsTask', () => {
  let task: DeleteExpiredTrashItemsTask;
  let jobExecutionRepository: DeepMocked<SequelizeJobExecutionRepository>;
  let fileRepository: DeepMocked<SequelizeFileRepository>;
  let folderRepository: DeepMocked<SequelizeFolderRepository>;
  let featureLimitsRepository: DeepMocked<SequelizeFeatureLimitsRepository>;
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
    featureLimitsRepository = moduleRef.get(SequelizeFeatureLimitsRepository);
    configService = moduleRef.get(ConfigService);
  });

  it('When initialized, then service should be defined', () => {
    expect(task).toBeDefined();
  });

  describe('scheduleCleanup', () => {
    it('When job execution is disabled, then it should not execute the job', async () => {
      configService.get.mockReturnValue(false);
      const startJobSpy = jest.spyOn(task, 'startJob');

      await task.scheduleCleanup();

      expect(startJobSpy).not.toHaveBeenCalled();
    });
  });

  describe('createJobInitialization', () => {
    const mockStartedJob: JobExecutionModel = {
      id: 'job-123',
      startedAt: new Date('2026-03-10T10:00:00Z'),
    } as JobExecutionModel;

    it('When called with metadata, then it should call startJob with the provided metadata', async () => {
      const metadata = { someKey: 'someValue' };
      jobExecutionRepository.startJob.mockResolvedValue(mockStartedJob);

      const result = await task.createJobInitialization(metadata);

      expect(jobExecutionRepository.startJob).toHaveBeenCalledWith(
        JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
        metadata,
      );
      expect(result).toEqual({ startedJob: mockStartedJob });
    });

    it('When called without metadata, then it should call startJob with undefined', async () => {
      jobExecutionRepository.startJob.mockResolvedValue(mockStartedJob);

      const result = await task.createJobInitialization();

      expect(jobExecutionRepository.startJob).toHaveBeenCalledWith(
        JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
        undefined,
      );
      expect(result).toEqual({ startedJob: mockStartedJob });
    });
  });

  describe('startJob', () => {
    const mockStartedJob: JobExecutionModel = {
      id: 'job-123',
      startedAt: new Date('2026-03-10T10:00:00Z'),
    } as JobExecutionModel;

    beforeEach(() => {
      jest
        .spyOn(task, 'createJobInitialization')
        .mockResolvedValue({ startedJob: mockStartedJob });
      jobExecutionRepository.markAsCompleted.mockResolvedValue({} as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('When no tier configs exist, then it should complete with zero deletions', async () => {
      featureLimitsRepository.findTiersWithLimitByLabel.mockResolvedValue([]);

      await task.startJob();

      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        mockStartedJob.id,
        { filesDeleted: 0, foldersDeleted: 0 },
      );
      expect(
        fileRepository.deleteExpiredTrashFilesByTier,
      ).not.toHaveBeenCalled();
      expect(
        folderRepository.deleteExpiredTrashFoldersByTier,
      ).not.toHaveBeenCalled();
    });

    it('When tier config has retentionDays=30, then it should call repos with correct args and accumulate totals', async () => {
      const tierId = 'tier-uuid-1';
      // cutoffDate must be AFTER firstDeploymentDate (2026-03-10) for the tier to be processed
      // firstDeploymentDate >= cutoffDate → FALSE → process
      const cutoffDate = new Date('2026-03-11T00:00:00Z');

      jest.spyOn(Time, 'daysAgo').mockReturnValue(cutoffDate);

      featureLimitsRepository.findTiersWithLimitByLabel.mockResolvedValue([
        {
          tier: { id: tierId } as any,
          limit: { value: '30' } as any,
        },
      ]);
      fileRepository.deleteExpiredTrashFilesByTier.mockResolvedValue([
        'file-1',
        'file-2',
      ]);
      folderRepository.deleteExpiredTrashFoldersByTier.mockResolvedValue([
        'folder-1',
      ]);

      await task.startJob();

      expect(fileRepository.deleteExpiredTrashFilesByTier).toHaveBeenCalledWith(
        tierId,
        cutoffDate,
        expect.any(Number),
      );
      expect(
        folderRepository.deleteExpiredTrashFoldersByTier,
      ).toHaveBeenCalledWith(tierId, cutoffDate, expect.any(Number));
      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        mockStartedJob.id,
        { filesDeleted: 2, foldersDeleted: 1 },
      );
    });

    it('When deletion throws an error, then it should mark the job as failed and rethrow', async () => {
      const error = new Error('DB error');
      // cutoffDate after firstDeploymentDate so the tier is not skipped
      const cutoffDate = new Date('2026-03-11T00:00:00Z');

      jest.spyOn(Time, 'daysAgo').mockReturnValue(cutoffDate);

      featureLimitsRepository.findTiersWithLimitByLabel.mockResolvedValue([
        {
          tier: { id: 'tier-1' } as any,
          limit: { value: '30' } as any,
        },
      ]);
      fileRepository.deleteExpiredTrashFilesByTier.mockRejectedValue(error);

      await task.startJob();

      expect(jobExecutionRepository.markAsFailed).toHaveBeenCalledWith(
        mockStartedJob.id,
        { errorMessage: error.message },
      );
    });

    describe('cutoff date edge cases', () => {
      it('When retentionDays=1, then it should skip (not enough time elapsed since deploy)', async () => {
        // Time.daysAgo(1) = 2026-03-09, firstDeploymentDate (2026-03-10) >= 2026-03-09 → SKIP
        jest
          .spyOn(Time, 'daysAgo')
          .mockReturnValue(new Date('2026-03-09T00:00:00Z'));

        featureLimitsRepository.findTiersWithLimitByLabel.mockResolvedValue([
          {
            tier: { id: 'tier-1' } as any,
            limit: { value: '1' } as any,
          },
        ]);

        await task.startJob();

        expect(
          fileRepository.deleteExpiredTrashFilesByTier,
        ).not.toHaveBeenCalled();
      });

      it('When cutoffDate equals firstDeploymentDate exactly, then it should execute', async () => {
        jest
          .spyOn(Time, 'daysAgo')
          .mockReturnValue(new Date('2026-03-10T00:00:00Z'));

        featureLimitsRepository.findTiersWithLimitByLabel.mockResolvedValue([
          {
            tier: { id: 'tier-1' } as any,
            limit: { value: '0' } as any,
          },
        ]);

        await task.startJob();

        expect(fileRepository.deleteExpiredTrashFilesByTier).toHaveBeenCalled();
      });

      it('When retentionDays=30, then it should process (cutoffDate is after firstDeploymentDate)', async () => {
        // For processing: firstDeploymentDate (2026-03-10) >= cutoffDate must be FALSE
        // so cutoffDate must be after firstDeploymentDate
        const cutoffDate = new Date('2026-03-11T00:00:00Z');
        jest.spyOn(Time, 'daysAgo').mockReturnValue(cutoffDate);

        featureLimitsRepository.findTiersWithLimitByLabel.mockResolvedValue([
          {
            tier: { id: 'tier-1' } as any,
            limit: { value: '30' } as any,
          },
        ]);
        fileRepository.deleteExpiredTrashFilesByTier.mockResolvedValue([]);
        folderRepository.deleteExpiredTrashFoldersByTier.mockResolvedValue([]);

        await task.startJob();

        expect(fileRepository.deleteExpiredTrashFilesByTier).toHaveBeenCalled();
        expect(
          folderRepository.deleteExpiredTrashFoldersByTier,
        ).toHaveBeenCalled();
      });

      it('When multiple tiers are mixed, then only the tier with sufficient retention is processed', async () => {
        const tierAId = 'tier-a';
        const tierBId = 'tier-b';
        // Tier A: cutoffDate <= firstDeploymentDate → SKIP
        const cutoffDateA = new Date('2026-03-09T00:00:00Z');
        // Tier B: cutoffDate > firstDeploymentDate → PROCESS
        const cutoffDateB = new Date('2026-03-11T00:00:00Z');

        jest
          .spyOn(Time, 'daysAgo')
          .mockReturnValueOnce(cutoffDateA) // tier A (retentionDays=1)
          .mockReturnValueOnce(cutoffDateB); // tier B (retentionDays=30)

        featureLimitsRepository.findTiersWithLimitByLabel.mockResolvedValue([
          {
            tier: { id: tierAId } as any,
            limit: { value: '1' } as any,
          },
          {
            tier: { id: tierBId } as any,
            limit: { value: '30' } as any,
          },
        ]);
        fileRepository.deleteExpiredTrashFilesByTier.mockResolvedValue([]);
        folderRepository.deleteExpiredTrashFoldersByTier.mockResolvedValue([]);

        await task.startJob();

        expect(
          fileRepository.deleteExpiredTrashFilesByTier,
        ).toHaveBeenCalledTimes(1);
        expect(
          fileRepository.deleteExpiredTrashFilesByTier,
        ).toHaveBeenCalledWith(tierBId, cutoffDateB, expect.any(Number));
        expect(
          fileRepository.deleteExpiredTrashFilesByTier,
        ).not.toHaveBeenCalledWith(
          tierAId,
          expect.anything(),
          expect.anything(),
        );
      });

      it('When limit.value is a string number, then it should be correctly converted to number', async () => {
        const cutoffDate = new Date('2026-03-11T00:00:00Z');
        const daysAgoSpy = jest
          .spyOn(Time, 'daysAgo')
          .mockReturnValue(cutoffDate);

        featureLimitsRepository.findTiersWithLimitByLabel.mockResolvedValue([
          {
            tier: { id: 'tier-1' } as any,
            limit: { value: '30' } as any,
          },
        ]);
        fileRepository.deleteExpiredTrashFilesByTier.mockResolvedValue([]);
        folderRepository.deleteExpiredTrashFoldersByTier.mockResolvedValue([]);

        await task.startJob();

        expect(daysAgoSpy).toHaveBeenCalledWith(30); // Number('30') = 30
      });
    });
  });

  describe('deleteExpiredItems', () => {
    it('When deleteBatch returns fewer items than batchSize, then it should return the total count', async () => {
      const deleteBatch = jest.fn().mockResolvedValue(['a', 'b', 'c']);

      const result = await task['deleteExpiredItems'](deleteBatch, jest.fn());

      expect(result).toBe(3);
      expect(deleteBatch).toHaveBeenCalledTimes(1);
    });

    it('When deleteBatch returns full batches then a partial batch, then it should accumulate total count', async () => {
      const batch1 = Array.from({ length: 100 }, (_, i) => `uuid-a${i}`);
      const batch2 = Array.from({ length: 5 }, (_, i) => `uuid-b${i}`);
      const deleteBatch = jest
        .fn()
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2);

      const result = await task['deleteExpiredItems'](deleteBatch, jest.fn());

      expect(result).toBe(105);
      expect(deleteBatch).toHaveBeenCalledTimes(2);
    });

    it('When the same UUID appears in 3 consecutive batches, then it should throw an error', async () => {
      const repeatedUuid = 'repeated-uuid';
      // Must return exactly batchSize=99 items so the loop continues
      const batch = [
        repeatedUuid,
        ...Array.from({ length: 99 }, (_, i) => `uuid-${i}`),
      ];
      const deleteBatch = jest.fn().mockResolvedValue(batch);

      await expect(
        task['deleteExpiredItems'](deleteBatch, jest.fn()),
      ).rejects.toThrow(
        `Same UUID ${repeatedUuid} repeated 3 times in consecutive batches`,
      );
    });

    it('When deleteBatch returns empty array, then it should return 0', async () => {
      const deleteBatch = jest.fn().mockResolvedValue([]);

      const result = await task['deleteExpiredItems'](deleteBatch, jest.fn());

      expect(result).toBe(0);
      expect(deleteBatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('beforeApplicationShutdown', () => {
    it('When called with a signal, then it should mark the current job as aborted with the signal reason', async () => {
      task['currentJobId'] = 'job-123';
      jobExecutionRepository.markAsAborted.mockResolvedValue({} as any);

      await task.beforeApplicationShutdown('SIGTERM');

      expect(jobExecutionRepository.markAsAborted).toHaveBeenCalledWith(
        'job-123',
        { reason: 'Process terminated with signal SIGTERM' },
      );
    });

    it('When called without a signal, then it should mark the current job as aborted with undefined signal', async () => {
      task['currentJobId'] = 'job-456';
      jobExecutionRepository.markAsAborted.mockResolvedValue({} as any);

      await task.beforeApplicationShutdown();

      expect(jobExecutionRepository.markAsAborted).toHaveBeenCalledWith(
        'job-456',
        { reason: 'Process terminated with signal undefined' },
      );
    });
  });
});
