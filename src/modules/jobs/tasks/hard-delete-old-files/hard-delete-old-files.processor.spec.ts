import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { type Job } from 'bullmq';
import { v4 } from 'uuid';
import { HardDeleteOldFilesProcessor } from './hard-delete-old-files.processor';
import { SequelizeFileRepository } from '../../../file/file.repository';
import { Time } from '../../../../lib/time';

const BATCH_SIZE = 100;
const SIX_MONTHS_IN_DAYS = 180;
const FROZEN_NOW = new Date('2026-03-25T12:00:00Z');

const makeJob = (): Job<Record<string, never>> =>
  ({ id: v4(), data: {}, attemptsMade: 0, opts: { attempts: 3 } }) as Job<
    Record<string, never>
  >;

describe('HardDeleteOldFilesProcessor', () => {
  let processor: HardDeleteOldFilesProcessor;
  let fileRepository: DeepMocked<SequelizeFileRepository>;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(FROZEN_NOW);

    const moduleRef = await Test.createTestingModule({
      providers: [HardDeleteOldFilesProcessor],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    processor = moduleRef.get(HardDeleteOldFilesProcessor);
    fileRepository = moduleRef.get(SequelizeFileRepository);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('When initialized, then service should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('When no files are found, then it should return filesDeleted: 0 without hard deleting files', async () => {
      fileRepository.findDeletedFilesUpdatedBefore.mockResolvedValue([]);

      const result = await processor.process(makeJob());

      expect(result).toEqual({ filesDeleted: 0 });
      expect(fileRepository.destroyDeletedFilesByUuids).not.toHaveBeenCalled();
    });

    it('When a partial batch is found, then the loop runs once and returns the correct total', async () => {
      const uuids = Array.from({ length: 42 }, () => v4());
      fileRepository.findDeletedFilesUpdatedBefore
        .mockResolvedValueOnce(uuids)
        .mockResolvedValueOnce([]);
      fileRepository.destroyDeletedFilesByUuids.mockResolvedValue(uuids.length);

      const result = await processor.process(makeJob());

      expect(result).toEqual({ filesDeleted: 42 });
      expect(fileRepository.destroyDeletedFilesByUuids).toHaveBeenCalledTimes(
        1,
      );
    });

    it('When a full batch is found then a partial batch, then the loop runs twice and sums the total', async () => {
      const fullBatch = Array.from({ length: BATCH_SIZE }, () => v4());
      const partialBatch = Array.from({ length: 37 }, () => v4());

      fileRepository.findDeletedFilesUpdatedBefore
        .mockResolvedValueOnce(fullBatch)
        .mockResolvedValueOnce(partialBatch)
        .mockResolvedValueOnce([]);
      fileRepository.destroyDeletedFilesByUuids
        .mockResolvedValueOnce(BATCH_SIZE)
        .mockResolvedValueOnce(37);

      const result = await processor.process(makeJob());

      expect(result).toEqual({ filesDeleted: BATCH_SIZE + 37 });
      expect(fileRepository.destroyDeletedFilesByUuids).toHaveBeenCalledTimes(
        2,
      );
    });

    it('When called, then it should pass a cutoff date 180 days in the past and the batch size to findDeletedFilesUpdatedBefore', async () => {
      fileRepository.findDeletedFilesUpdatedBefore.mockResolvedValue([]);
      const expectedCutoff = Time.daysAgo(SIX_MONTHS_IN_DAYS);

      await processor.process(makeJob());

      expect(fileRepository.findDeletedFilesUpdatedBefore).toHaveBeenCalledWith(
        expectedCutoff,
        BATCH_SIZE,
      );
    });

    it('When findDeletedFilesUpdatedBefore throws, then the error should propagate out of process()', async () => {
      const error = new Error('DB connection lost');
      fileRepository.findDeletedFilesUpdatedBefore.mockRejectedValue(error);

      await expect(processor.process(makeJob())).rejects.toThrow(error);
    });

    it('When destroyDeletedFilesByUuids throws, then the error should propagate out of process()', async () => {
      const error = new Error('DB connection lost');
      fileRepository.findDeletedFilesUpdatedBefore.mockResolvedValue([v4()]);
      fileRepository.destroyDeletedFilesByUuids.mockRejectedValue(error);

      await expect(processor.process(makeJob())).rejects.toThrow(error);
    });
  });
});
