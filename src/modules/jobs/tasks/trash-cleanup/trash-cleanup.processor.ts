import newrelic from 'newrelic';
import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { type Job } from 'bullmq';
import { JobName } from '../../constants';
import { SequelizeJobExecutionRepository } from '../../repositories/job-execution.repository';
import { SequelizeFileRepository } from '../../../file/file.repository';
import { SequelizeFolderRepository } from '../../../folder/folder.repository';
import { TRASH_EXPIRATION_START_DATE } from '../../../trash/trash-expiration.utils';
import { Time } from '../../../../lib/time';
import { TRASH_CLEANUP_QUEUE } from './trash-cleanup.scheduler';
import { SequelizeFeatureLimitsRepository } from '../../../feature-limit/feature-limit.repository';
import { LimitLabels } from '../../../feature-limit/limits.enum';

export interface TrashCleanupJobData {
  tierId: string;
  tierName: string;
}

@Processor(TRASH_CLEANUP_QUEUE, {
  concurrency: 2,
  stalledInterval: 30_000,
  maxStalledCount: 2,
})
export class TrashCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(TrashCleanupProcessor.name);
  private readonly firstDeploymentDate = TRASH_EXPIRATION_START_DATE;
  private readonly batchSize = 100;

  constructor(
    private readonly jobExecutionRepository: SequelizeJobExecutionRepository,
    private readonly fileRepository: SequelizeFileRepository,
    private readonly folderRepository: SequelizeFolderRepository,
    private readonly featureLimitsRepository: SequelizeFeatureLimitsRepository,
  ) {
    super();
  }

  async process(job: Job<TrashCleanupJobData>) {
    return newrelic.startBackgroundTransaction(
      JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
      'Job',
      async () => {
        const transaction = newrelic.getTransaction();
        try {
          const { tierId, tierName } = job.data;

          const limit =
            await this.featureLimitsRepository.findLimitByLabelAndTier(
              tierId,
              LimitLabels.TrashRetentionDays,
            );
          const cutoffDate = Time.daysAgo(Number(limit.value));

          if (this.firstDeploymentDate > cutoffDate) {
            this.logger.log(
              {
                tierId,
                tierName,
                cutoffDate,
                firstDeploymentDate: this.firstDeploymentDate,
              },
              'Skipping tier: cutoff date is before first deployment date.',
            );
            return { skipped: true };
          }

          const startedJob = await this.jobExecutionRepository.startJob(
            JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
            { metadata: { tierId, tierName, cutoffDate } },
          );

          this.logger.log(
            { jobId: startedJob.id, tierId, tierName, cutoffDate },
            'Processing tier with retention policy.',
          );

          try {
            const filesDeleted = await this.deleteExpiredItems(
              (limit) =>
                this.fileRepository.deleteExpiredTrashFilesByTier(
                  tierId,
                  cutoffDate,
                  limit,
                ),
              (total) =>
                this.logger.log(
                  {
                    jobId: startedJob.id,
                    tierId,
                    tierName,
                    totalDeletedFiles: total,
                  },
                  'Finished processing a batch of files for the tier.',
                ),
              (uuids) =>
                this.logger.log(
                  {
                    jobId: startedJob.id,
                    tierId,
                    tierName,
                    deletedUuids: uuids,
                  },
                  'Batch of items deleted.',
                ),
            );

            const foldersDeleted = await this.deleteExpiredItems(
              (limit) =>
                this.folderRepository.deleteExpiredTrashFoldersByTier(
                  tierId,
                  cutoffDate,
                  limit,
                ),
              (total) =>
                this.logger.log(
                  {
                    jobId: startedJob.id,
                    tierId,
                    tierName,
                    totalDeletedFolders: total,
                  },
                  'Finished processing a batch of folders for the tier.',
                ),
              (uuids) =>
                this.logger.log(
                  {
                    jobId: startedJob.id,
                    tierId,
                    tierName,
                    deletedUuids: uuids,
                  },
                  'Batch of items deleted.',
                ),
            );

            newrelic.addCustomAttribute('filesDeleted', filesDeleted);
            newrelic.addCustomAttribute('foldersDeleted', foldersDeleted);

            await this.jobExecutionRepository.markAsCompleted(startedJob.id, {
              tierId,
              tierName,
              cutoffDate,
              filesDeleted,
              foldersDeleted,
            });

            this.logger.log(
              {
                jobId: startedJob.id,
                tierId,
                tierName,
                filesDeleted,
                foldersDeleted,
              },
              'Tier cleanup completed successfully.',
            );

            return { filesDeleted, foldersDeleted };
          } catch (error) {
            this.logger.error(
              {
                jobId: startedJob.id,
                tierId,
                tierName,
                message: error.message,
                stack: error.stack,
              },
              'Tier cleanup failed.',
            );
            await this.jobExecutionRepository.markAsFailed(startedJob.id, {
              tierId,
              tierName,
              cutoffDate,
              errorMessage: error.message,
            });
            throw error;
          }
        } catch (error) {
          newrelic.noticeError(error);
          throw error;
        } finally {
          transaction.end();
        }
      },
    );
  }

  private async deleteExpiredItems(
    deleteBatch: (limit: number) => Promise<string[]>,
    onFinish: (totalDeleted: number) => void,
    onBatch?: (deletedUuids: string[]) => void,
  ): Promise<number> {
    let totalDeleted = 0;
    let previousBatchUuid: string | null = null;
    let sameUuidRepeatedTimes = 0;

    let deletedUuids: string[];
    do {
      deletedUuids = await deleteBatch(this.batchSize);
      if (deletedUuids.length === 0) break;
      // TODO: remove logs after monitoring the job for a while to ensure there are no issues with the deletion process
      onBatch?.(deletedUuids);

      // detect if same UUID keeps appearing (shouldn't happen with atomic UPDATE)
      if (previousBatchUuid && deletedUuids.includes(previousBatchUuid)) {
        sameUuidRepeatedTimes++;
        if (sameUuidRepeatedTimes >= 3) {
          throw new Error(
            `Same UUID ${previousBatchUuid} repeated ${sameUuidRepeatedTimes} times in consecutive batches`,
          );
        }
        this.logger.warn(
          { previousBatchUuid, sameUuidRepeatedTimes },
          'Same UUID detected in consecutive batches.',
        );
      } else {
        sameUuidRepeatedTimes = 0;
        previousBatchUuid = deletedUuids[0];
      }

      totalDeleted += deletedUuids.length;
    } while (deletedUuids.length === this.batchSize);

    onFinish(totalDeleted);
    return totalDeleted;
  }
}
