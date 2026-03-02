import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobName } from '../constants';
import { RedisService } from '../../../externals/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { SequelizeJobExecutionRepository } from '../repositories/job-execution.repository';
import { SequelizeFileRepository } from '../../file/file.repository';
import { SequelizeFolderRepository } from '../../folder/folder.repository';

@Injectable()
export class DeleteExpiredTrashItemsTask {
  private readonly logger = new Logger(DeleteExpiredTrashItemsTask.name);
  private readonly lockTtl = 60 * 1000; // 1 minute
  private readonly lockKey = 'cleanup:expired-trash-items';
  private readonly batchSize = 100;

  constructor(
    private readonly jobExecutionRepository: SequelizeJobExecutionRepository,
    private readonly fileRepository: SequelizeFileRepository,
    private readonly folderRepository: SequelizeFolderRepository,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
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
      await this.startJob();
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

  async startJob() {
    const { lastCompletedJob, startedJob } =
      await this.initializeJobExecution();

    this.logger.log(
      `[${startedJob.id}] Starting expired trash items cleanup job${
        lastCompletedJob
          ? ` (last completed: ${lastCompletedJob.completedAt})`
          : ' (first run)'
      }`,
    );

    try {
      let totalFilesDeleted = 0;
      let totalFoldersDeleted = 0;

      for await (const fileIds of this.yieldExpiredFileIds()) {
        await this.fileRepository.deleteFilesByUuid(fileIds);
        totalFilesDeleted += fileIds.length;
        this.logger.log(
          `[${startedJob.id}] Deleted ${fileIds.length} expired files. Total: ${totalFilesDeleted}`,
        );
      }

      for await (const folderIds of this.yieldExpiredFolderIds()) {
        await this.folderRepository.deleteFoldersByUuid(folderIds);
        totalFoldersDeleted += folderIds.length;
        this.logger.log(
          `[${startedJob.id}] Deleted ${folderIds.length} expired folders. Total: ${totalFoldersDeleted}`,
        );
      }

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

  async initializeJobExecution(jobMetadata?: Record<string, any>) {
    const lastCompletedJob =
      await this.jobExecutionRepository.getLastSuccessful(
        JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
      );

    const startedJob = await this.jobExecutionRepository.startJob(
      JobName.EXPIRED_TRASH_ITEMS_CLEANUP,
      jobMetadata,
    );

    return { lastCompletedJob, startedJob };
  }

  private async *yieldExpiredFileIds() {
    let resultCount = 0;

    do {
      const fileIds = await this.fileRepository.findExpiredTrashFileIds(
        this.batchSize,
      );

      resultCount = fileIds.length;

      if (resultCount > 0) {
        yield fileIds;
      }
    } while (resultCount === this.batchSize);
  }

  private async *yieldExpiredFolderIds() {
    let resultCount = 0;

    do {
      const folderIds = await this.folderRepository.findExpiredTrashFolderIds(
        this.batchSize,
      );

      resultCount = folderIds.length;

      if (resultCount > 0) {
        yield folderIds;
      }
    } while (resultCount === this.batchSize);
  }
}
