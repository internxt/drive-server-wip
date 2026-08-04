import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { type Job } from 'bullmq';
import { v4 } from 'uuid';
import { CleanupDeletedFilesTableProcessor } from './cleanup-deleted-files-table.processor';
import { SequelizeDeletedFilesRepository } from '../../repositories/deleted-files.repository';
import { Time } from '../../../../lib/time';

const BATCH_SIZE = 1000;
const SIX_MONTHS_IN_DAYS = 180;
const FROZEN_NOW = new Date('2026-03-25T12:00:00Z');

const makeJob = (): Job<Record<string, never>> =>
  ({ id: v4(), data: {}, attemptsMade: 0, opts: { attempts: 3 } }) as Job<
    Record<string, never>
  >;

describe('CleanupDeletedFilesTableProcessor', () => {
  let processor: CleanupDeletedFilesTableProcessor;
  let deletedFilesRepository: DeepMocked<SequelizeDeletedFilesRepository>;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(FROZEN_NOW);

    const moduleRef = await Test.createTestingModule({
      providers: [CleanupDeletedFilesTableProcessor],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    processor = moduleRef.get(CleanupDeletedFilesTableProcessor);
    deletedFilesRepository = moduleRef.get(
      SequelizeDeletedFilesRepository,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('When initialized, then service should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('When no records are found, then it should return recordsDeleted: 0 without hard deleting records', async () => {
      deletedFilesRepository.findUpdatedBefore.mockResolvedValue([]);

      const result = await processor.process(makeJob());

      expect(result).toEqual({ recordsDeleted: 0 });
      expect(deletedFilesRepository.destroyByFileIds).not.toHaveBeenCalled();
    });

    it('When a partial batch is found, then the loop runs once and returns the correct total', async () => {
      const fileIds = Array.from({ length: 42 }, () => v4());
      deletedFilesRepository.findUpdatedBefore
        .mockResolvedValueOnce(fileIds)
        .mockResolvedValueOnce([]);
      deletedFilesRepository.destroyByFileIds.mockResolvedValue(
        fileIds.length,
      );

      const result = await processor.process(makeJob());

      expect(result).toEqual({ recordsDeleted: 42 });
      expect(deletedFilesRepository.destroyByFileIds).toHaveBeenCalledTimes(
        1,
      );
    });

    it('When a full batch is found then a partial batch, then the loop runs twice and sums the total', async () => {
      const fullBatch = Array.from({ length: BATCH_SIZE }, () => v4());
      const partialBatch = Array.from({ length: 37 }, () => v4());

      deletedFilesRepository.findUpdatedBefore
        .mockResolvedValueOnce(fullBatch)
        .mockResolvedValueOnce(partialBatch)
        .mockResolvedValueOnce([]);
      deletedFilesRepository.destroyByFileIds
        .mockResolvedValueOnce(BATCH_SIZE)
        .mockResolvedValueOnce(37);

      const result = await processor.process(makeJob());

      expect(result).toEqual({ recordsDeleted: BATCH_SIZE + 37 });
      expect(deletedFilesRepository.destroyByFileIds).toHaveBeenCalledTimes(
        2,
      );
    });

    it('When called, then it should pass a cutoff date 180 days in the past and the batch size to findUpdatedBefore', async () => {
      deletedFilesRepository.findUpdatedBefore.mockResolvedValue([]);
      const expectedCutoff = Time.daysAgo(SIX_MONTHS_IN_DAYS);

      await processor.process(makeJob());

      expect(deletedFilesRepository.findUpdatedBefore).toHaveBeenCalledWith(
        expectedCutoff,
        BATCH_SIZE,
      );
    });

    it('When findUpdatedBefore throws, then the error should propagate out of process()', async () => {
      const error = new Error('DB connection lost');
      deletedFilesRepository.findUpdatedBefore.mockRejectedValue(error);

      await expect(processor.process(makeJob())).rejects.toThrow(error);
    });

    it('When destroyByFileIds throws, then the error should propagate out of process()', async () => {
      const error = new Error('DB connection lost');
      deletedFilesRepository.findUpdatedBefore.mockResolvedValue([v4()]);
      deletedFilesRepository.destroyByFileIds.mockRejectedValue(error);

      await expect(processor.process(makeJob())).rejects.toThrow(error);
    });
  });
});
