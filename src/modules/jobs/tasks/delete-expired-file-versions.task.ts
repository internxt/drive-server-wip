import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobName } from '../constants';
import { RedisService } from '../../../externals/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { DeleteExpiredFileVersionsAction } from '../../file/actions';

@Injectable()
export class DeleteExpiredFileVersionsTask {
  private readonly logger = new Logger(DeleteExpiredFileVersionsTask.name);
  private readonly lockTtl = 60 * 60 * 1000; // 1 hour
  private readonly lockKey = 'job:delete-expired-file-versions';

  constructor(
    private readonly deleteExpiredFileVersionsAction: DeleteExpiredFileVersionsAction,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  @Cron('0 3 * * *', { name: JobName.EXPIRED_FILE_VERSIONS_CLEANUP })
  async scheduleExpiredVersionsCleanup() {
    const shouldExecuteCronjobs = this.configService.get<boolean>(
      'executeCronjobs',
      false,
    );

    if (!shouldExecuteCronjobs) {
      return;
    }

    await this.runJob();
  }

  async runJob() {
    this.logger.log('Starting expired file versions cleanup job');

    try {
      const lockAcquired = await this.redisService.tryAcquireLock(
        this.lockKey,
        this.lockTtl,
      );

      if (!lockAcquired) {
        this.logger.warn(
          'Lock already acquired by another instance, skipping...',
        );
        return;
      }

      this.logger.log('Lock acquired! Starting job execution');
      await this.processExpiredVersions();
    } catch (error) {
      this.logger.error(
        `Expired file versions cleanup job failed: ${error.message}`,
      );
    } finally {
      const released = await this.redisService.releaseLock(this.lockKey);
      if (released) {
        this.logger.log('Lock released successfully');
      } else {
        this.logger.warn('Lock was not released (may have expired)');
      }
    }
  }

  private async processExpiredVersions(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.deleteExpiredFileVersionsAction.execute();

      const duration = Date.now() - startTime;
      this.logger.log(
        `Expired file versions cleanup completed: ${result.deletedCount} versions deleted in ${duration}ms`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Error during expired versions cleanup after ${duration}ms: ${error.message}`,
      );
      throw error;
    }
  }
}
