import newrelic from 'newrelic';
import {
  type BeforeApplicationShutdown,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobName } from '../constants';
import { ConfigService } from '@nestjs/config';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';
import { SequelizeFileRepository } from '../../file/file.repository';
import { SequelizeFolderRepository } from '../../folder/folder.repository';
import { SequelizeFeatureLimitsRepository } from '../../feature-limit/feature-limit.repository';
import { TRASH_EXPIRATION_START_DATE } from '../../trash/trash-expiration.utils';
import { Time } from '../../../lib/time';
import {
  LimitLabels,
  PLAN_FREE_INDIVIDUAL_TIER_LABEL,
} from '../../feature-limit/limits.enum';

@Injectable()
export class DeleteExpiredTrashItemsTask implements BeforeApplicationShutdown {
  private readonly logger = new Logger(DeleteExpiredTrashItemsTask.name);
  private readonly firstDeploymentDate = TRASH_EXPIRATION_START_DATE;
  private readonly batchSize = 100;
  private currentJobId: string | null = null;

  constructor(
    private readonly jobExecutionRepository: SequelizeJobExecutionRepository,
    private readonly fileRepository: SequelizeFileRepository,
    private readonly folderRepository: SequelizeFolderRepository,
    private readonly configService: ConfigService,
    private readonly featureLimitsRepository: SequelizeFeatureLimitsRepository,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
    // Prevents execution of multiple instances of the job at the same time in case a previous execution is still running
    waitForCompletion: true,
  })
  async scheduleCleanup() {
    const shouldExecuteCronjobs = this.configService.get<boolean>(
      'executeCronjobs',
      false,
    );

    if (!shouldExecuteCronjobs) {
      return;
    }

    try {
      await newrelic.startBackgroundTransaction(
        JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
        'Job',
        async () => {
          const transaction = newrelic.getTransaction();
          try {
            await this.startJob();
          } catch (error) {
            newrelic.noticeError(error);
            throw error;
          } finally {
            transaction.end();
          }
        },
      );
    } catch (error) {
      this.logger.error(
        { name: error.name, message: error.message, stack: error.stack },
        'Expired trash items cleanup job could not be setup.',
      );
    }
  }

  async createJobInitialization(jobMetadata?: Record<string, any>) {
    const startedJob = await this.jobExecutionRepository.startJob(
      JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
      jobMetadata,
    );

    return { startedJob };
  }

  async startJob() {
    const { startedJob } = await this.createJobInitialization();
    this.currentJobId = startedJob.id;

    const tierConfigs = (
      await this.featureLimitsRepository.findTiersWithLimitByLabel(
        LimitLabels.TrashRetentionDays,
      )
    ).sort((a, b) => {
      if (a.tier.label === PLAN_FREE_INDIVIDUAL_TIER_LABEL) return 1;
      if (b.tier.label === PLAN_FREE_INDIVIDUAL_TIER_LABEL) return -1;
      return 0;
    });

    this.logger.log(
      {
        jobId: this.currentJobId,
        tierConfigs: tierConfigs.map((c) => ({
          tierId: c.tier.id,
          tierLabel: c.tier.label,
          retentionDays: c.limit.value,
        })),
      },
      'Tier configs loaded.',
    );
    let totalFilesDeleted = 0;
    let totalFoldersDeleted = 0;

    try {
      for (const { tier, limit } of tierConfigs) {
        const retentionDays = Number(limit.value);
        const cutoffDate = Time.daysAgo(retentionDays);

        if (this.firstDeploymentDate > cutoffDate) continue;

        this.logger.log(
          {
            jobId: this.currentJobId,
            tierId: tier.id,
            cutoffDate,
            retentionDays,
          },
          'Processing tier with retention policy.',
        );

        totalFilesDeleted += await this.deleteExpiredItems(
          (limit) =>
            this.fileRepository.deleteExpiredTrashFilesByTier(
              tier.id,
              cutoffDate,
              limit,
            ),
          (totalDeletedFiles: number) =>
            this.logger.log(
              { jobId: this.currentJobId, tierId: tier.id, totalDeletedFiles },
              'Finished processing a batch of files for the tier.',
            ),
        );

        totalFoldersDeleted += await this.deleteExpiredItems(
          (limit) =>
            this.folderRepository.deleteExpiredTrashFoldersByTier(
              tier.id,
              cutoffDate,
              limit,
            ),
          (totalDeletedFolders: number) =>
            this.logger.log(
              {
                jobId: this.currentJobId,
                tierId: tier.id,
                totalDeletedFolders,
              },
              'Finished processing a batch of folders for the tier.',
            ),
        );
      }

      newrelic.addCustomAttribute('filesDeleted', totalFilesDeleted);
      newrelic.addCustomAttribute('foldersDeleted', totalFoldersDeleted);

      await this.jobExecutionRepository.markAsCompleted(this.currentJobId, {
        filesDeleted: totalFilesDeleted,
        foldersDeleted: totalFoldersDeleted,
      });

      this.logger.log(
        { jobId: this.currentJobId, totalFilesDeleted, totalFoldersDeleted },
        'Cleanup job completed successfully.',
      );
    } catch (error) {
      this.logger.error(
        {
          jobId: this.currentJobId,
          message: error.message,
          stack: error.stack,
        },
        'Cleanup job failed with error.',
      );
      await this.jobExecutionRepository.markAsFailed(this.currentJobId, {
        errorMessage: error.message,
        filesDeleted: totalFilesDeleted,
        foldersDeleted: totalFoldersDeleted,
      });
      return;
    }
  }

  private async deleteExpiredItems(
    deleteBatch: (limit: number) => Promise<string[]>,
    onFinish: (totalDeleted: number) => void,
  ): Promise<number> {
    let totalDeleted = 0;
    let previousBatchUuid: string | null = null;
    let sameUuidRepeatedTimes = 0;

    let deletedUuids: string[];
    do {
      deletedUuids = await deleteBatch(this.batchSize);
      if (deletedUuids.length === 0) break;
      // TODO: remove logs after monitoring the job for a while to ensure there are no issues with the deletion process
      this.logger.log(
        { jobId: this.currentJobId, deletedUuids },
        'Batch of items deleted.',
      );

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

  async beforeApplicationShutdown(signal?: string) {
    this.logger.warn(
      { jobId: this.currentJobId, signal },
      'Application shutting down, marking job as aborted.',
    );
    await this.jobExecutionRepository.markAsAborted(this.currentJobId, {
      reason: `Process terminated with signal ${signal}`,
    });
  }
}
