import newrelic from 'newrelic';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobName } from '../constants';
import { RedisService } from '../../../externals/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';
import { SequelizeFileRepository } from '../../file/file.repository';
import { SequelizeFolderRepository } from '../../folder/folder.repository';
import { SequelizeFeatureLimitsRepository } from '../../feature-limit/feature-limit.repository';
import { TRASH_EXPIRATION_START_DATE } from '../../trash/trash-expiration.utils';
import { Time } from '../../../lib/time';
import { LimitLabels } from '../../feature-limit/limits.enum';

@Injectable()
export class DeleteExpiredTrashItemsTask {
  private readonly logger = new Logger(DeleteExpiredTrashItemsTask.name);
  private readonly firstDeploymentDate = TRASH_EXPIRATION_START_DATE;
  private readonly lockTtl = 60 * 1000; // 1 minute
  private readonly lockKey = 'cleanup:expired-trash-items';
  private readonly batchSize = 500;

  constructor(
    private readonly jobExecutionRepository: SequelizeJobExecutionRepository,
    private readonly fileRepository: SequelizeFileRepository,
    private readonly folderRepository: SequelizeFolderRepository,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly featureLimitsRepository: SequelizeFeatureLimitsRepository,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES, {
    name: JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
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
      const acquired = await this.redisService.tryAcquireLock(
        this.lockKey,
        this.lockTtl,
      );

      if (!acquired) {
        this.logger.log(
          'Lock already acquired by another instance, skipping...',
        );
        return;
      }

      this.logger.log(
        'Lock acquired! Starting expired trash items cleanup job',
      );

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
        `Expired trash items cleanup job could not be setup. error: ${JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        )}`,
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

    const tierConfigs =
      await this.featureLimitsRepository.findTiersWithLimitByLabel(
        LimitLabels.TrashRetentionDays,
      );

    this.logger.log(
      `[${startedJob.id}] Config loaded: ${tierConfigs.length} tier(s) with trash retention.`,
    );

    try {
      let totalFilesDeleted = 0;
      let totalFoldersDeleted = 0;

      for (const { tier, limit } of tierConfigs) {
        const retentionDays = Number(limit.value);
        const cutoffDate = Time.daysAgo(retentionDays);

        if (this.firstDeploymentDate >= cutoffDate) continue;

        this.logger.log(
          `[${startedJob.id}] Processing tier ${tier.id}: cutoffDate=${cutoffDate.toISOString()}, retentionDays=${retentionDays}`,
        );

        totalFilesDeleted += await this.deleteExpiredItems((limit) =>
          this.fileRepository.deleteExpiredTrashFilesByTier(
            tier.id,
            cutoffDate,
            limit,
          ),
        );

        totalFoldersDeleted += await this.deleteExpiredItems((limit) =>
          this.folderRepository.deleteExpiredTrashFoldersByTier(
            tier.id,
            cutoffDate,
            limit,
          ),
        );
      }

      newrelic.addCustomAttribute('filesDeleted', totalFilesDeleted);
      newrelic.addCustomAttribute('foldersDeleted', totalFoldersDeleted);

      await this.jobExecutionRepository.markAsCompleted(startedJob.id, {
        filesDeleted: totalFilesDeleted,
        foldersDeleted: totalFoldersDeleted,
      });

      this.logger.log(
        `[${startedJob.id}] Cleanup completed: ${totalFilesDeleted} files and ${totalFoldersDeleted} folders deleted`,
      );
    } catch (error) {
      this.logger.error(`[${startedJob.id}] Error: ${error.message}`);
      await this.jobExecutionRepository.markAsFailed(startedJob.id, {
        errorMessage: error.message,
      });
      throw error;
    }
  }

  private async deleteExpiredItems(
    deleteBatch: (limit: number) => Promise<string[]>,
  ): Promise<number> {
    let totalDeleted = 0;
    let previousBatchUuid: string | null = null;
    let sameUuidRepeatedTimes = 0;

    let deletedUuids: string[];
    do {
      deletedUuids = await deleteBatch(this.batchSize);
      if (deletedUuids.length === 0) break;

      // detect if same UUID keeps appearing (shouldn't happen with atomic UPDATE)
      if (previousBatchUuid && deletedUuids.includes(previousBatchUuid)) {
        sameUuidRepeatedTimes++;
        if (sameUuidRepeatedTimes >= 3) {
          throw new Error(
            `Same UUID ${previousBatchUuid} repeated ${sameUuidRepeatedTimes} times in consecutive batches`,
          );
        }
        this.logger.warn(
          `UUID ${previousBatchUuid} repeated in batch, attempt ${sameUuidRepeatedTimes}`,
        );
      } else {
        sameUuidRepeatedTimes = 0;
        previousBatchUuid = deletedUuids[0];
      }

      totalDeleted += deletedUuids.length;
      this.logger.log(
        `Deleted ${deletedUuids.length} expired items. Total: ${totalDeleted}`,
      );
    } while (deletedUuids.length === this.batchSize);

    return totalDeleted;
  }
}
