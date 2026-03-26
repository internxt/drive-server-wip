import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { type Job } from 'bullmq';
import { SequelizeFileRepository } from '../../../file/file.repository';
import { Time } from '../../../../lib/time';
import { HARD_DELETE_OLD_FILES_QUEUE } from './hard-delete-old-files.scheduler';
import { JobName } from '../../constants';

const SIX_MONTHS_IN_DAYS = 180;
const BATCH_SIZE = 100;
const MAX_BATCHES = 100_000;
const LOG_PROGRESS_EVERY_N_BATCHES = 500;

@Processor(HARD_DELETE_OLD_FILES_QUEUE, {
  concurrency: 1,
  stalledInterval: 30_000,
  maxStalledCount: 2,
})
export class HardDeleteOldFilesProcessor extends WorkerHost {
  private readonly logger = new Logger(JobName.HARD_DELETE_OLD_DELETED_FILES);

  constructor(private readonly fileRepository: SequelizeFileRepository) {
    super();
  }

  async process(_job: Job) {
    const cutoffDate = Time.daysAgo(SIX_MONTHS_IN_DAYS);

    this.logger.log(
      { cutoffDate },
      'Starting hard-delete of old deleted files.',
    );

    const filesDeleted = await this.deleteInBatches(cutoffDate);

    this.logger.log(
      { filesDeleted },
      'Hard-delete of old deleted files completed.',
    );

    return { filesDeleted };
  }

  private async deleteInBatches(cutoffDate: Date): Promise<number> {
    let totalDeleted = 0;
    let batchNumber = 0;

    while (batchNumber < MAX_BATCHES) {
      const uuids = await this.fileRepository.findDeletedFilesUpdatedBefore(
        cutoffDate,
        BATCH_SIZE,
      );

      this.logger.log({ uuids }, 'files to delete');

      if (uuids.length === 0) break;

      const deletedCount =
        await this.fileRepository.destroyDeletedFilesByUuids(uuids);

      totalDeleted += deletedCount;
      batchNumber++;

      this.logger.log({ batchNumber, totalDeleted }, 'Hard-delete progress.');

      if (uuids.length < BATCH_SIZE) break;
    }

    return totalDeleted;
  }
}
