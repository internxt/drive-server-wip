jest.mock('newrelic', () => ({
  startBackgroundTransaction: jest.fn((_name, _group, cb) => cb()),
  getTransaction: jest.fn(() => ({ end: jest.fn() })),
  noticeError: jest.fn(),
  addCustomAttribute: jest.fn(),
}));

import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { type Job } from 'bullmq';
import { v4 } from 'uuid';
import {
  TrashCleanupProcessor,
  type TrashCleanupJobData,
} from './trash-cleanup.processor';
import { SequelizeJobExecutionRepository } from '../../repositories/job-execution.repository';
import { SequelizeFileRepository } from '../../../file/file.repository';
import { SequelizeFolderRepository } from '../../../folder/folder.repository';
import { SequelizeFeatureLimitsRepository } from '../../../feature-limit/feature-limit.repository';
import { LimitLabels, LimitTypes } from '../../../feature-limit/limits.enum';
import { Time } from '../../../../lib/time';
import { newFeatureLimit, newTier } from '../../../../../test/fixtures';
import { type JobExecutionModel } from '../../models/job-execution.model';

const makeJob = (data: TrashCleanupJobData): Job<TrashCleanupJobData> =>
  ({ id: v4(), data, attemptsMade: 0, opts: { attempts: 3 } }) as any;

describe('TrashCleanupProcessor', () => {
  let processor: TrashCleanupProcessor;
  let jobExecutionRepository: DeepMocked<SequelizeJobExecutionRepository>;
  let fileRepository: DeepMocked<SequelizeFileRepository>;
  let folderRepository: DeepMocked<SequelizeFolderRepository>;
  let featureLimitsRepository: DeepMocked<SequelizeFeatureLimitsRepository>;

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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('When initialized, then service should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    const tier = newTier();
    const limit = newFeatureLimit({
      type: LimitTypes.Counter,
      value: '30',
      label: LimitLabels.TrashRetentionDays,
    });
    const jobData: TrashCleanupJobData = {
      tierId: tier.id,
      tierName: tier.label,
    };
    const startedJob = { id: 'exec-job-1' } as JobExecutionModel;
    // cutoffDate after TRASH_EXPIRATION_START_DATE (2026-03-10) so the tier is not skipped
    const cutoffDate = new Date('2026-03-11T00:00:00Z');

    describe('When the cutoff date is before the first deployment date', () => {
      it('When called, then it should skip processing and not create a job execution record', async () => {
        featureLimitsRepository.findLimitByLabelAndTier.mockResolvedValue(
          limit,
        );
        jest
          .spyOn(Time, 'daysAgo')
          .mockReturnValue(new Date('2026-03-09T00:00:00Z'));

        const result = await processor.process(makeJob(jobData));

        expect(result).toEqual({ skipped: true });
        expect(jobExecutionRepository.startJob).not.toHaveBeenCalled();
      });
    });

    describe('When the cutoff date is valid', () => {
      beforeEach(() => {
        featureLimitsRepository.findLimitByLabelAndTier.mockResolvedValue(
          limit,
        );
        jest.spyOn(Time, 'daysAgo').mockReturnValue(cutoffDate);
        jobExecutionRepository.startJob.mockResolvedValue(startedJob);
      });

      it('When called, then it should look up the retention limit for the correct tier and label', async () => {
        fileRepository.deleteExpiredTrashFilesByTier.mockResolvedValue([]);
        folderRepository.deleteExpiredTrashFoldersByTier.mockResolvedValue([]);

        await processor.process(makeJob(jobData));

        expect(
          featureLimitsRepository.findLimitByLabelAndTier,
        ).toHaveBeenCalledWith(tier.id, LimitLabels.TrashRetentionDays);
      });

      it('When files and folders are deleted, then it should mark the job as completed with the correct totals', async () => {
        const fileUuids = [v4(), v4()];
        const folderUuids = [v4()];

        fileRepository.deleteExpiredTrashFilesByTier
          .mockResolvedValueOnce(fileUuids)
          .mockResolvedValueOnce([]);
        folderRepository.deleteExpiredTrashFoldersByTier
          .mockResolvedValueOnce(folderUuids)
          .mockResolvedValueOnce([]);

        const result = await processor.process(makeJob(jobData));

        expect(result).toEqual({ filesDeleted: 2, foldersDeleted: 1 });
        expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
          startedJob.id,
          expect.objectContaining({
            tierId: tier.id,
            tierName: tier.label,
            filesDeleted: 2,
            foldersDeleted: 1,
          }),
        );
        expect(jobExecutionRepository.markAsFailed).not.toHaveBeenCalled();
      });

      it('When the repo returns a full batch, then it should keep fetching until a partial batch is returned', async () => {
        const fullBatch = Array.from({ length: 100 }, () => v4());
        const partialBatch = [v4(), v4()];

        fileRepository.deleteExpiredTrashFilesByTier
          .mockResolvedValueOnce(fullBatch)
          .mockResolvedValueOnce(partialBatch);
        folderRepository.deleteExpiredTrashFoldersByTier.mockResolvedValue([]);

        const result = await processor.process(makeJob(jobData));

        expect(result).toEqual({ filesDeleted: 102, foldersDeleted: 0 });
        expect(
          fileRepository.deleteExpiredTrashFilesByTier,
        ).toHaveBeenCalledTimes(2);
      });

      it('When deletion throws, then it should mark the job as failed and rethrow the error', async () => {
        const error = new Error('DB connection lost');
        fileRepository.deleteExpiredTrashFilesByTier.mockRejectedValue(error);

        await expect(processor.process(makeJob(jobData))).rejects.toThrow(
          error,
        );

        expect(jobExecutionRepository.markAsFailed).toHaveBeenCalledWith(
          startedJob.id,
          expect.objectContaining({
            tierId: tier.id,
            tierName: tier.label,
            errorMessage: error.message,
          }),
        );
        expect(jobExecutionRepository.markAsCompleted).not.toHaveBeenCalled();
      });

      it('When the same UUID appears in 3 consecutive batches, then it should mark the job as failed and throw', async () => {
        const repeatedUuid = v4();
        // batch must be exactly batchSize=100 so the loop keeps running
        const batch = [repeatedUuid, ...Array.from({ length: 99 }, () => v4())];
        fileRepository.deleteExpiredTrashFilesByTier.mockResolvedValue(batch);

        await expect(processor.process(makeJob(jobData))).rejects.toThrow(
          `Same UUID ${repeatedUuid} repeated 3 times in consecutive batches`,
        );

        expect(jobExecutionRepository.markAsFailed).toHaveBeenCalledWith(
          startedJob.id,
          expect.objectContaining({ tierId: tier.id, tierName: tier.label }),
        );
      });
    });

    describe('When findLimitByLabelAndTier fails', () => {
      it('When called, then it should rethrow without creating a job execution record', async () => {
        const error = new Error('Limit not found');
        featureLimitsRepository.findLimitByLabelAndTier.mockRejectedValue(
          error,
        );

        await expect(processor.process(makeJob(jobData))).rejects.toThrow(
          error,
        );

        expect(jobExecutionRepository.startJob).not.toHaveBeenCalled();
        expect(jobExecutionRepository.markAsFailed).not.toHaveBeenCalled();
      });
    });

    describe('When startJob fails', () => {
      it('When called, then it should rethrow without attempting to mark as failed', async () => {
        featureLimitsRepository.findLimitByLabelAndTier.mockResolvedValue(
          limit,
        );
        jest.spyOn(Time, 'daysAgo').mockReturnValue(cutoffDate);
        const error = new Error('Could not start job');
        jobExecutionRepository.startJob.mockRejectedValue(error);

        await expect(processor.process(makeJob(jobData))).rejects.toThrow(
          error,
        );

        expect(jobExecutionRepository.markAsFailed).not.toHaveBeenCalled();
      });
    });
  });
});
