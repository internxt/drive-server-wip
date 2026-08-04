import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { type Job } from 'bullmq';
import { SequelizeDeletedFilesRepository } from '../../repositories/deleted-files.repository';
import { Time } from '../../../../lib/time';
import { CLEANUP_DELETED_FILES_TABLE_QUEUE } from './cleanup-deleted-files-table.scheduler';
import { JobName } from '../../constants';

const SIX_MONTHS_IN_DAYS = 180;
const BATCH_SIZE = 1000;
const MAX_BATCHES = 100_000; // 100M records

@Processor(CLEANUP_DELETED_FILES_TABLE_QUEUE, {
  concurrency: 1,
  stalledInterval: 30_000,
  maxStalledCount: 2,
})
export class CleanupDeletedFilesTableProcessor extends WorkerHost {
  private readonly logger = new Logger(
    JobName.CLEANUP_DELETED_FILES_TABLE,
  );

  constructor(
    private readonly deletedFilesRepository: SequelizeDeletedFilesRepository,
  ) {
    super();
  }

  async process(_job: Job) {
    try {
      const cutoffDate = Time.daysAgo(SIX_MONTHS_IN_DAYS);

      this.logger.log(
        { cutoffDate },
        'Starting hard-delete of old deleted_files_new records.',
      );

      const recordsDeleted = await this.deleteInBatches(cutoffDate);

      this.logger.log(
        { recordsDeleted },
        'Hard-delete of old deleted_files_new records completed.',
      );

      return { recordsDeleted };
    } catch (error) {
      this.logger.error(
        { error },
        'Hard-delete of old deleted_files_new records failed.',
      );
      throw error;
    }
  }

  private async deleteInBatches(cutoffDate: Date): Promise<number> {
    let totalDeleted = 0;
    let batchNumber = 0;
    let batchLength: number;

    do {
      const fileIds = await this.deletedFilesRepository.findUpdatedBefore(
        cutoffDate,
        BATCH_SIZE,
      );
      batchLength = fileIds.length;

      if (batchLength === 0) {
        break;
      }

      this.logger.log({ fileIds }, 'deleted_files_new records to delete');

      const deletedCount =
        await this.deletedFilesRepository.destroyByFileIds(fileIds);

      totalDeleted += deletedCount;
      batchNumber++;

      this.logger.log({ batchNumber, totalDeleted }, 'Hard-delete progress.');
    } while (batchLength === BATCH_SIZE && batchNumber < MAX_BATCHES);

    return totalDeleted;
  }
}
