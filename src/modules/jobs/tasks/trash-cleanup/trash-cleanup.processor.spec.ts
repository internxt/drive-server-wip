import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { type Job } from 'bullmq';
import { v4 } from 'uuid';
import {
  TrashCleanupProcessor,
  type TrashCleanupJobData,
} from './trash-cleanup.processor';
import { TrashCleanupItemType } from './trash-cleanup.scheduler';
import { SequelizeJobExecutionRepository } from '../../repositories/job-execution.repository';
import { SequelizeFileRepository } from '../../../file/file.repository';
import { SequelizeFolderRepository } from '../../../folder/folder.repository';
import { SequelizeFeatureLimitsRepository } from '../../../feature-limit/feature-limit.repository';
import { LimitLabels } from '../../../feature-limit/limits.enum';
import { Time } from '../../../../lib/time';
import { type JobExecutionModel } from '../../models/job-execution.model';

const makeJob = (data: TrashCleanupJobData): Job<TrashCleanupJobData> =>
  ({ id: v4(), data, attemptsMade: 0, opts: { attempts: 3 } }) as any;

describe('TrashCleanupProcessor', () => {
  let processor: TrashCleanupProcessor;
  let jobExecutionRepository: DeepMocked<SequelizeJobExecutionRepository>;
  let fileRepository: DeepMocked<SequelizeFileRepository>;
  let folderRepository: DeepMocked<SequelizeFolderRepository>;
  let featureLimitsRepository: DeepMocked<SequelizeFeatureLimitsRepository>;

  const startedJob = { id: 'exec-job-1' } as JobExecutionModel;
  const filesJob = makeJob({ itemType: TrashCleanupItemType.Files });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [TrashCleanupProcessor],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    processor = moduleRef.get(TrashCleanupProcessor);
    jobExecutionRepository = moduleRef.get(SequelizeJobExecutionRepository);
    fileRepository = moduleRef.get(SequelizeFileRepository);
    folderRepository = moduleRef.get(SequelizeFolderRepository);
    featureLimitsRepository = moduleRef.get(SequelizeFeatureLimitsRepository);

    jobExecutionRepository.startJob.mockResolvedValue(startedJob);
    jest.spyOn(Time, 'daysAgo').mockReturnValue(new Date('2026-10-01'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('When initialized, then service should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('When the job has no known item type, then it should skip it', async () => {
      const legacyJob = makeJob({ tierId: v4(), tierName: 'free' } as any);

      const result = await processor.process(legacyJob);

      expect(result).toEqual({ skipped: true });
      expect(jobExecutionRepository.startJob).not.toHaveBeenCalled();
    });

    it('When there are no users with trash, then it should complete the pass', async () => {
      fileRepository.findUserIdsWithTrashedFiles.mockResolvedValueOnce([]);

      const result = await processor.process(filesJob);

      expect(result).toEqual({
        deleted: 0,
        usersScanned: 0,
        passCompleted: true,
      });
      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        startedJob.id,
        expect.objectContaining({ passCompleted: true }),
      );
    });

    it('When a chunk of users is processed, then it should fetch the next users after the last one', async () => {
      fileRepository.findUserIdsWithTrashedFiles
        .mockResolvedValueOnce([10, 20])
        .mockResolvedValueOnce([]);
      featureLimitsRepository.findEffectiveLimitValueByUserIds.mockResolvedValueOnce(
        [],
      );

      await processor.process(filesJob);

      expect(
        fileRepository.findUserIdsWithTrashedFiles,
      ).toHaveBeenNthCalledWith(1, 0, expect.any(Number));
      expect(
        fileRepository.findUserIdsWithTrashedFiles,
      ).toHaveBeenNthCalledWith(2, 20, expect.any(Number));
    });

    it('When users have expired trash, then it should delete using each user effective retention', async () => {
      const cutoffDate = new Date('2026-10-01');
      fileRepository.findUserIdsWithTrashedFiles
        .mockResolvedValueOnce([10, 20, 30])
        .mockResolvedValueOnce([]);
      featureLimitsRepository.findEffectiveLimitValueByUserIds.mockResolvedValueOnce(
        [
          { userId: 10, value: '2' },
          { userId: 20, value: null },
          { userId: 30, value: '30' },
        ],
      );
      fileRepository.deleteExpiredTrashFilesByUsers.mockResolvedValueOnce([
        v4(),
        v4(),
      ]);

      const result = await processor.process(filesJob);

      expect(
        featureLimitsRepository.findEffectiveLimitValueByUserIds,
      ).toHaveBeenCalledWith([10, 20, 30], LimitLabels.TrashRetentionDays);
      expect(
        fileRepository.deleteExpiredTrashFilesByUsers,
      ).toHaveBeenCalledWith(
        [
          { userId: 10, cutoffDate },
          { userId: 30, cutoffDate },
        ],
        expect.any(Number),
      );
      expect(result).toEqual(
        expect.objectContaining({ deleted: 2, usersScanned: 3 }),
      );
    });

    it('When a full batch is deleted, then it should keep deleting for the same users', async () => {
      const fullBatch = Array.from({ length: 1000 }, () => v4());
      fileRepository.findUserIdsWithTrashedFiles
        .mockResolvedValueOnce([10])
        .mockResolvedValueOnce([]);
      featureLimitsRepository.findEffectiveLimitValueByUserIds.mockResolvedValueOnce(
        [{ userId: 10, value: '2' }],
      );
      fileRepository.deleteExpiredTrashFilesByUsers
        .mockResolvedValueOnce(fullBatch)
        .mockResolvedValueOnce([v4()]);

      const result = await processor.process(filesJob);

      expect(
        fileRepository.deleteExpiredTrashFilesByUsers,
      ).toHaveBeenCalledTimes(2);
      expect(result).toEqual(expect.objectContaining({ deleted: 1001 }));
    });

    it('When the retention cutoff is before the first deployment date, then it should skip the user', async () => {
      (Time.daysAgo as jest.Mock).mockReturnValue(new Date('2026-03-01'));
      fileRepository.findUserIdsWithTrashedFiles
        .mockResolvedValueOnce([10])
        .mockResolvedValueOnce([]);
      featureLimitsRepository.findEffectiveLimitValueByUserIds.mockResolvedValueOnce(
        [{ userId: 10, value: '365' }],
      );

      await processor.process(filesJob);

      expect(
        fileRepository.deleteExpiredTrashFilesByUsers,
      ).toHaveBeenCalledWith([], expect.any(Number));
    });

    it('When the time budget runs out mid chunk, then it should stop without completing the pass', async () => {
      const now = new Date('2026-10-20T10:00:00Z');
      jest
        .spyOn(Time, 'now')
        .mockReturnValueOnce(now)
        .mockReturnValueOnce(now)
        .mockReturnValue(new Date('2026-10-20T11:00:00Z'));
      fileRepository.findUserIdsWithTrashedFiles.mockResolvedValueOnce([10]);
      featureLimitsRepository.findEffectiveLimitValueByUserIds.mockResolvedValueOnce(
        [{ userId: 10, value: '2' }],
      );

      const result = await processor.process(filesJob);

      expect(
        fileRepository.deleteExpiredTrashFilesByUsers,
      ).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ passCompleted: false }));
    });

    it('When processing folders, then it should use the folder repository', async () => {
      const foldersJob = makeJob({ itemType: TrashCleanupItemType.Folders });
      folderRepository.findUserIdsWithTrashedFolders
        .mockResolvedValueOnce([10])
        .mockResolvedValueOnce([]);
      featureLimitsRepository.findEffectiveLimitValueByUserIds.mockResolvedValueOnce(
        [{ userId: 10, value: '2' }],
      );
      folderRepository.deleteExpiredTrashFoldersByUsers.mockResolvedValueOnce([
        v4(),
      ]);

      const result = await processor.process(foldersJob);

      expect(fileRepository.findUserIdsWithTrashedFiles).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ deleted: 1 }));
    });

    it('When deletion fails, then it should mark the execution as failed and rethrow', async () => {
      const error = new Error('Query timed out');
      fileRepository.findUserIdsWithTrashedFiles
        .mockResolvedValueOnce([10])
        .mockResolvedValueOnce([]);
      featureLimitsRepository.findEffectiveLimitValueByUserIds.mockResolvedValueOnce(
        [{ userId: 10, value: '2' }],
      );
      fileRepository.deleteExpiredTrashFilesByUsers.mockRejectedValueOnce(
        error,
      );

      await expect(processor.process(filesJob)).rejects.toThrow(error);

      expect(jobExecutionRepository.markAsFailed).toHaveBeenCalledWith(
        startedJob.id,
        expect.objectContaining({ errorMessage: error.message }),
      );
    });
  });
});
