import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { type Job } from 'bullmq';
import { JobName } from '../../constants';
import { SequelizeJobExecutionRepository } from '../../repositories/job-execution.repository';
import { SequelizeFileRepository } from '../../../file/file.repository';
import { SequelizeFolderRepository } from '../../../folder/folder.repository';
import {
  TRASH_EXPIRATION_START_DATE,
  type TrashExpirationTarget,
} from '../../../trash/trash-expiration.utils';
import { Time } from '../../../../lib/time';
import {
  TRASH_CLEANUP_QUEUE,
  TrashCleanupItemType,
} from './trash-cleanup.scheduler';
import { SequelizeFeatureLimitsRepository } from '../../../feature-limit/feature-limit.repository';
import { LimitLabels } from '../../../feature-limit/limits.enum';
import { RedisService } from '../../../../externals/redis/redis.service';

export interface TrashCleanupJobData {
  itemType: TrashCleanupItemType;
}

export const TRASH_CLEANUP_CURSOR_KEY_PREFIX = 'trash-cleanup:cursor:';

@Processor(TRASH_CLEANUP_QUEUE, {
  concurrency: 2,
  stalledInterval: 30_000,
  maxStalledCount: 2,
})
export class TrashCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(TrashCleanupProcessor.name);
  private readonly firstDeploymentDate = TRASH_EXPIRATION_START_DATE;
  private readonly usersPerChunk = 500;
  private readonly deleteBatchSize = 1000;
  // Keeps a single run from going on indefinitely
  private readonly timeBudgetMinutes = 30;

  constructor(
    private readonly jobExecutionRepository: SequelizeJobExecutionRepository,
    private readonly fileRepository: SequelizeFileRepository,
    private readonly folderRepository: SequelizeFolderRepository,
    private readonly featureLimitsRepository: SequelizeFeatureLimitsRepository,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  async process(job: Job<TrashCleanupJobData>) {
    if (!Object.values(TrashCleanupItemType).includes(job.data?.itemType)) {
      this.logger.warn({ data: job.data }, 'Skipping unknown trash job.');
      return { skipped: true };
    }

    const { itemType } = job.data;
    const startCursor = await this.getCursor(itemType);
    const startedJob = await this.jobExecutionRepository.startJob(
      JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
      { metadata: { itemType, startCursor } },
    );

    try {
      const result = await this.cleanup(
        itemType,
        startCursor,
        Time.dateWithTimeAdded(this.timeBudgetMinutes, 'minute'),
      );

      await this.jobExecutionRepository.markAsCompleted(startedJob.id, {
        itemType,
        startCursor,
        ...result,
      });

      this.logger.log(
        { jobId: startedJob.id, itemType, startCursor, ...result },
        'Trash cleanup run completed.',
      );

      return result;
    } catch (error) {
      this.logger.error(
        {
          jobId: startedJob.id,
          itemType,
          message: error.message,
          stack: error.stack,
        },
        'Trash cleanup run failed.',
      );
      await this.jobExecutionRepository.markAsFailed(startedJob.id, {
        itemType,
        startCursor,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  private async cleanup(
    itemType: TrashCleanupItemType,
    startCursor: number,
    deadline: Date,
  ): Promise<{
    deleted: number;
    usersScanned: number;
    endCursor: number;
    passCompleted: boolean;
  }> {
    let cursor = startCursor;
    let deleted = 0;
    let usersScanned = 0;

    while (Time.now() < deadline) {
      const userIds = await this.findNextUserIdsWithTrash(itemType, cursor);

      if (userIds.length === 0) {
        await this.saveCursor(itemType, 0);
        return { deleted, usersScanned, endCursor: 0, passCompleted: true };
      }

      const targets = await this.buildTargets(userIds);
      const chunkResult = await this.deleteChunk(itemType, targets, deadline);
      deleted += chunkResult.deleted;

      if (!chunkResult.completed) {
        break;
      }

      usersScanned += userIds.length;
      cursor = userIds[userIds.length - 1];
      await this.saveCursor(itemType, cursor);
    }

    this.logger.warn(
      { itemType, endCursor: cursor, deleted },
      'Trash cleanup deadline reached.',
    );
    return { deleted, usersScanned, endCursor: cursor, passCompleted: false };
  }

  private async deleteChunk(
    itemType: TrashCleanupItemType,
    targets: TrashExpirationTarget[],
    deadline: Date,
  ): Promise<{ deleted: number; completed: boolean }> {
    let deleted = 0;
    let deletedUuids: string[];

    do {
      if (Time.now() >= deadline) {
        return { deleted, completed: false };
      }
      deletedUuids = await this.deleteBatch(itemType, targets);
      deleted += deletedUuids.length;
    } while (deletedUuids.length === this.deleteBatchSize);

    return { deleted, completed: true };
  }

  private async buildTargets(
    userIds: number[],
  ): Promise<TrashExpirationTarget[]> {
    const limits =
      await this.featureLimitsRepository.findEffectiveLimitValueByUserIds(
        userIds,
        LimitLabels.TrashRetentionDays,
      );

    const targets: TrashExpirationTarget[] = [];
    for (const { userId, value } of limits) {
      const retentionDays = Number(value);
      if (value === null || !Number.isFinite(retentionDays)) {
        continue;
      }
      const cutoffDate = Time.daysAgo(retentionDays);
      if (this.firstDeploymentDate > cutoffDate) {
        continue;
      }
      targets.push({ userId, cutoffDate });
    }
    return targets;
  }

  private findNextUserIdsWithTrash(
    itemType: TrashCleanupItemType,
    afterUserId: number,
  ): Promise<number[]> {
    return itemType === TrashCleanupItemType.Files
      ? this.fileRepository.findUserIdsWithTrashedFiles(
          afterUserId,
          this.usersPerChunk,
        )
      : this.folderRepository.findUserIdsWithTrashedFolders(
          afterUserId,
          this.usersPerChunk,
        );
  }

  private deleteBatch(
    itemType: TrashCleanupItemType,
    targets: TrashExpirationTarget[],
  ): Promise<string[]> {
    return itemType === TrashCleanupItemType.Files
      ? this.fileRepository.deleteExpiredTrashFilesByUsers(
          targets,
          this.deleteBatchSize,
        )
      : this.folderRepository.deleteExpiredTrashFoldersByUsers(
          targets,
          this.deleteBatchSize,
        );
  }

  private async getCursor(itemType: TrashCleanupItemType): Promise<number> {
    const client = await this.redisService.getClient();
    const value = await client.get(TRASH_CLEANUP_CURSOR_KEY_PREFIX + itemType);
    const cursor = Number(value);
    return Number.isInteger(cursor) && cursor > 0 ? cursor : 0;
  }

  private async saveCursor(
    itemType: TrashCleanupItemType,
    cursor: number,
  ): Promise<void> {
    const client = await this.redisService.getClient();
    await client.set(TRASH_CLEANUP_CURSOR_KEY_PREFIX + itemType, cursor);
  }
}
