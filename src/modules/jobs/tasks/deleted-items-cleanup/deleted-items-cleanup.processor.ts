import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { type Job } from 'bullmq';
import { SequelizeFolderRepository } from '../../../folder/folder.repository';
import { SequelizeFileRepository } from '../../../file/file.repository';
import { SequelizeJobExecutionRepository } from '../../repositories/job-execution.repository';
import { JobName } from '../../constants';
import { Time } from '../../../../lib/time';
import { DELETED_ITEMS_CLEANUP_QUEUE } from './deleted-items-cleanup.scheduler';

const BATCH_SIZE = 100;

@Processor(DELETED_ITEMS_CLEANUP_QUEUE, {
  concurrency: 2,
  stalledInterval: 30_000,
  maxStalledCount: 2,
})
export class DeletedItemsCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(JobName.DELETED_ITEMS_CLEANUP);

  constructor(
    private readonly jobExecutionRepository: SequelizeJobExecutionRepository,
    private readonly folderRepository: SequelizeFolderRepository,
    private readonly fileRepository: SequelizeFileRepository,
  ) {
    super();
  }

  async process(job: Job) {
    const isRetry = job.attemptsMade > 0;
    const maxAttempts = job.opts.attempts ?? 1;
    const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

    if (isRetry) {
      this.logger.warn(
        { jobId: job.id, attempt: job.attemptsMade + 1, maxAttempts },
        'Retrying deleted items cleanup job.',
      );
    }

    const untilDate = Time.now();
    const startDate = Time.dateWithTimeAdded(-30, 'minute', untilDate);

    this.logger.log(
      { jobId: job.id, startDate, untilDate },
      'Starting deleted items cleanup.',
    );

    const startedJob = await this.jobExecutionRepository.startJob(
      JobName.DELETED_ITEMS_CLEANUP,
      { metadata: { jobId: job.id, isRetry, attemptsMade: job.attemptsMade } },
    );

    const runPhase = (
      phase: string,
      generator: AsyncGenerator<string[], void, unknown>,
      processor: (folderUuids: string[]) => Promise<{ updatedCount: number }>,
    ) => this.processPhase({ jobId: job.id, phase }, generator, processor);

    try {
      const foldersWithChildrenProcessed = await runPhase(
        'FoldersPhase',
        this.yieldDeletedFoldersWithActiveChildren(startDate, untilDate),
        (uuids) => this.folderRepository.markChildFoldersAsRemoved(uuids),
      );

      const foldersWithFilesProcessed = await runPhase(
        'FilesPhase',
        this.yieldDeletedFoldersWithActiveFiles(startDate, untilDate),
        (uuids) => this.fileRepository.markFilesInFolderAsRemoved(uuids),
      );

      await this.jobExecutionRepository.markAsCompleted(startedJob.id, {
        jobId: job.id,
        foldersWithChildrenProcessed,
        foldersWithFilesProcessed,
      });

      this.logger.log(
        {
          jobId: job.id,
          foldersWithChildrenProcessed,
          foldersWithFilesProcessed,
        },
        'Deleted items cleanup completed.',
      );

      return { foldersWithChildrenProcessed, foldersWithFilesProcessed };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (isLastAttempt) {
        this.logger.error(
          { jobId: job.id, attemptsMade: job.attemptsMade, error },
          'Deleted items cleanup failed on final attempt.',
        );
        await this.jobExecutionRepository.markAsFailed(startedJob.id, {
          jobId: job.id,
          errorMessage,
          attemptsMade: job.attemptsMade,
        });
      } else {
        this.logger.warn(
          { jobId: job.id, attempt: job.attemptsMade + 1, error },
          'Deleted items cleanup attempt failed, will retry.',
        );
        await this.jobExecutionRepository.markAsFailed(startedJob.id, {
          jobId: job.id,
          errorMessage,
          note: 'intermediate-retry',
        });
      }
      throw error;
    }
  }

  private async processPhase(
    ctx: { jobId: string | number; phase: string },
    generator: AsyncGenerator<string[], void, unknown>,
    processor: (folderUuids: string[]) => Promise<{ updatedCount: number }>,
  ) {
    let firstFolderUuid: string | null = null;
    let sameFolderRepeatedTimes = 0;
    let processedItems = 0;

    for await (const folderUuids of generator) {
      if (folderUuids.length === 0) {
        this.logger.log(ctx, 'No more items to process.');
        break;
      }

      if (firstFolderUuid && folderUuids.includes(firstFolderUuid)) {
        ++sameFolderRepeatedTimes;
      } else {
        sameFolderRepeatedTimes = 0;
        firstFolderUuid = folderUuids[0];
      }

      if (sameFolderRepeatedTimes >= 3) {
        this.logger.error(
          { ...ctx, stuckFolderUuid: firstFolderUuid },
          'Folder UUID still present after 3 consecutive batches.',
        );
        throw new Error(
          `Same folder uuid repeated more than 3 times in consecutive batches during ${ctx.phase}`,
        );
      }

      const result = await processor(folderUuids);
      this.logger.log(
        { ...ctx, updatedCount: result.updatedCount },
        'Batch processed.',
      );

      processedItems += folderUuids.length;
    }

    return processedItems;
  }

  private async *yieldDeletedFoldersWithActiveChildren(
    startDate: Date,
    untilDate: Date,
  ) {
    let resultCount = 0;
    do {
      const folderUuids =
        await this.folderRepository.getDeletedFoldersWithNotDeletedChildren({
          startDate,
          untilDate,
          limit: BATCH_SIZE,
        });
      resultCount = folderUuids.length;
      yield folderUuids;
    } while (resultCount === BATCH_SIZE);
  }

  private async *yieldDeletedFoldersWithActiveFiles(
    startDate: Date,
    untilDate: Date,
  ) {
    let resultCount = 0;
    do {
      const folderUuids =
        await this.folderRepository.getDeletedFoldersWithNotDeletedFiles({
          startDate,
          untilDate,
          limit: BATCH_SIZE,
        });
      resultCount = folderUuids.length;
      yield folderUuids;
    } while (resultCount === BATCH_SIZE);
  }
}
