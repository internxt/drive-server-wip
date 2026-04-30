import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { type Job } from 'bullmq';
import { v4 } from 'uuid';
import { DeletedItemsCleanupProcessor } from './deleted-items-cleanup.processor';
import { SequelizeFolderRepository } from '../../../folder/folder.repository';
import { SequelizeFileRepository } from '../../../file/file.repository';
import { SequelizeJobExecutionRepository } from '../../repositories/job-execution.repository';
import { type JobExecutionModel } from '../../models/job-execution.model';

const BATCH_SIZE = 100;
const FROZEN_NOW = new Date('2026-04-30T14:00:00Z');
const WINDOW_START = new Date('2026-04-30T13:30:00Z');

const makeJob = (overrides: Partial<Job> = {}): Job =>
  ({
    id: v4(),
    data: {},
    attemptsMade: 0,
    opts: { attempts: 2 },
    ...overrides,
  }) as Job;

describe('DeletedItemsCleanupProcessor', () => {
  let processor: DeletedItemsCleanupProcessor;
  let folderRepository: DeepMocked<SequelizeFolderRepository>;
  let fileRepository: DeepMocked<SequelizeFileRepository>;
  let jobExecutionRepository: DeepMocked<SequelizeJobExecutionRepository>;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(FROZEN_NOW);

    const moduleRef = await Test.createTestingModule({
      providers: [DeletedItemsCleanupProcessor],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    processor = moduleRef.get(DeletedItemsCleanupProcessor);
    folderRepository = moduleRef.get(SequelizeFolderRepository);
    fileRepository = moduleRef.get(SequelizeFileRepository);
    jobExecutionRepository = moduleRef.get(SequelizeJobExecutionRepository);

    jobExecutionRepository.startJob.mockResolvedValue({
      id: v4(),
    } as JobExecutionModel);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('When initialized, then service should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('When no folders are found, then it should complete without updating children', async () => {
      folderRepository.getDeletedFoldersWithNotDeletedChildren.mockResolvedValue(
        [],
      );
      folderRepository.getDeletedFoldersWithNotDeletedFiles.mockResolvedValue(
        [],
      );

      const result = await processor.process(makeJob());

      expect(result).toEqual({
        foldersWithChildrenProcessed: 0,
        foldersWithFilesProcessed: 0,
      });
      expect(folderRepository.markChildFoldersAsRemoved).not.toHaveBeenCalled();
      expect(fileRepository.markFilesInFolderAsRemoved).not.toHaveBeenCalled();
    });

    it('When called, then it should scan the 30-minute window ending at now', async () => {
      folderRepository.getDeletedFoldersWithNotDeletedChildren.mockResolvedValue(
        [],
      );
      folderRepository.getDeletedFoldersWithNotDeletedFiles.mockResolvedValue(
        [],
      );

      await processor.process(makeJob());

      expect(
        folderRepository.getDeletedFoldersWithNotDeletedChildren,
      ).toHaveBeenCalledWith({
        startDate: WINDOW_START,
        untilDate: FROZEN_NOW,
        limit: BATCH_SIZE,
      });
    });

    it('When a full batch is found then a partial batch, then it loops until exhausted', async () => {
      const fullBatch = Array.from({ length: BATCH_SIZE }, () => v4());
      const partialBatch = Array.from({ length: 5 }, () => v4());

      folderRepository.getDeletedFoldersWithNotDeletedChildren
        .mockResolvedValueOnce(fullBatch)
        .mockResolvedValueOnce(partialBatch);
      folderRepository.markChildFoldersAsRemoved.mockResolvedValue({
        updatedCount: BATCH_SIZE,
      });
      folderRepository.getDeletedFoldersWithNotDeletedFiles.mockResolvedValue(
        [],
      );

      const result = await processor.process(makeJob());

      expect(result.foldersWithChildrenProcessed).toBe(BATCH_SIZE + 5);
      expect(folderRepository.markChildFoldersAsRemoved).toHaveBeenCalledTimes(
        2,
      );
    });

    it('When the same folder uuid appears 3 times in a row, then it should throw', async () => {
      const stuckUuid = v4();
      const batch = [
        stuckUuid,
        ...Array.from({ length: BATCH_SIZE - 1 }, () => v4()),
      ];

      folderRepository.getDeletedFoldersWithNotDeletedChildren.mockResolvedValue(
        batch,
      );
      folderRepository.markChildFoldersAsRemoved.mockResolvedValue({
        updatedCount: batch.length,
      });

      await expect(processor.process(makeJob())).rejects.toThrow(
        /same folder uuid repeated/i,
      );
    });

    it('When a different folder uuid appears after repeated ones, then it should reset the counter and continue', async () => {
      const repeatedUuid = v4();
      const differentUuid = v4();
      folderRepository.getDeletedFoldersWithNotDeletedChildren
        .mockResolvedValueOnce([
          repeatedUuid,
          ...Array.from({ length: BATCH_SIZE - 1 }, () => v4()),
        ])
        .mockResolvedValueOnce([
          repeatedUuid,
          ...Array.from({ length: BATCH_SIZE - 1 }, () => v4()),
        ])
        .mockResolvedValueOnce([
          differentUuid,
          ...Array.from({ length: BATCH_SIZE - 1 }, () => v4()),
        ]) // resets counter
        .mockResolvedValueOnce([repeatedUuid, v4()]); // partial batch — stops
      folderRepository.markChildFoldersAsRemoved.mockResolvedValue({
        updatedCount: BATCH_SIZE,
      });
      folderRepository.getDeletedFoldersWithNotDeletedFiles.mockResolvedValue(
        [],
      );

      await expect(processor.process(makeJob())).resolves.not.toThrow();
      expect(folderRepository.markChildFoldersAsRemoved).toHaveBeenCalledTimes(
        4,
      );
    });

    it('When the job is a retry, then it should record attemptsMade in the job execution metadata', async () => {
      folderRepository.getDeletedFoldersWithNotDeletedChildren.mockResolvedValue(
        [],
      );
      folderRepository.getDeletedFoldersWithNotDeletedFiles.mockResolvedValue(
        [],
      );
      const job = makeJob({ attemptsMade: 1 });

      await processor.process(job);

      expect(jobExecutionRepository.startJob).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          metadata: expect.objectContaining({ isRetry: true, attemptsMade: 1 }),
        }),
      );
    });

    it('When processing succeeds, then it should mark the job as completed with counts', async () => {
      folderRepository.getDeletedFoldersWithNotDeletedChildren.mockResolvedValue(
        [],
      );
      folderRepository.getDeletedFoldersWithNotDeletedFiles.mockResolvedValue(
        [],
      );

      await processor.process(makeJob());

      expect(jobExecutionRepository.markAsCompleted).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          foldersWithChildrenProcessed: 0,
          foldersWithFilesProcessed: 0,
        }),
      );
    });

    it('When processing fails on the final attempt, then it should mark the job as failed and rethrow', async () => {
      const error = new Error('DB error');
      folderRepository.getDeletedFoldersWithNotDeletedChildren.mockRejectedValue(
        error,
      );
      const job = makeJob({ attemptsMade: 1, opts: { attempts: 2 } });

      await expect(processor.process(job)).rejects.toThrow(error);

      expect(jobExecutionRepository.markAsFailed).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ errorMessage: error.message }),
      );
      expect(jobExecutionRepository.markAsCompleted).not.toHaveBeenCalled();
    });

    it('When processing fails on an intermediate attempt, then it should mark failed with note and rethrow', async () => {
      const error = new Error('DB error');
      folderRepository.getDeletedFoldersWithNotDeletedChildren.mockRejectedValue(
        error,
      );
      const job = makeJob({ attemptsMade: 0, opts: { attempts: 2 } });

      await expect(processor.process(job)).rejects.toThrow(error);

      expect(jobExecutionRepository.markAsFailed).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ note: 'intermediate-retry' }),
      );
    });
  });

  describe('yieldDeletedFoldersWithActiveChildren', () => {
    it('When called, then it should keep yielding until a partial batch is returned', async () => {
      const fullBatch = Array.from({ length: BATCH_SIZE }, () => v4());
      const partialBatch = [v4(), v4()];

      folderRepository.getDeletedFoldersWithNotDeletedChildren
        .mockResolvedValueOnce(fullBatch)
        .mockResolvedValueOnce(partialBatch);

      const batches: string[][] = [];
      for await (const batch of processor[
        'yieldDeletedFoldersWithActiveChildren'
      ](WINDOW_START, FROZEN_NOW)) {
        batches.push(batch);
      }

      expect(batches).toEqual([fullBatch, partialBatch]);
      expect(
        folderRepository.getDeletedFoldersWithNotDeletedChildren,
      ).toHaveBeenCalledTimes(2);
    });
  });

  describe('yieldDeletedFoldersWithActiveFiles', () => {
    it('When called, then it should keep yielding until a partial batch is returned', async () => {
      const fullBatch = Array.from({ length: BATCH_SIZE }, () => v4());
      const partialBatch = [v4()];

      folderRepository.getDeletedFoldersWithNotDeletedFiles
        .mockResolvedValueOnce(fullBatch)
        .mockResolvedValueOnce(partialBatch);

      const batches: string[][] = [];
      for await (const batch of processor['yieldDeletedFoldersWithActiveFiles'](
        WINDOW_START,
        FROZEN_NOW,
      )) {
        batches.push(batch);
      }

      expect(batches).toEqual([fullBatch, partialBatch]);
      expect(
        folderRepository.getDeletedFoldersWithNotDeletedFiles,
      ).toHaveBeenCalledTimes(2);
    });
  });
});
