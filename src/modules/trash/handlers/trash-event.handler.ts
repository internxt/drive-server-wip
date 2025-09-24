import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TrashUseCases } from '../trash.usecase';
import { TrashEmptyRequestedEvent } from '../events/trash-empty-requested.event';
import { RedisService } from '../../../externals/redis/redis.service';

@Injectable()
export class TrashEventHandler {
  private readonly logger = new Logger(TrashEventHandler.name);

  constructor(
    private readonly trashUseCases: TrashUseCases,
    private readonly redisService: RedisService,
  ) {}

  @OnEvent('trash.empty.requested')
  async handleEmptyTrashRequested(event: TrashEmptyRequestedEvent) {
    const { user, trashedFilesNumber, trashedFoldersNumber } = event;
    const lockKey = `empty-trash-lock:${user.id}`;

    let lockAcquired = false;

    try {
      lockAcquired = await this.redisService.tryAcquireLock(lockKey, 1000 * 2);
    } catch (error) {
      lockAcquired = true;
      this.logger.warn(
        { user: user.uuid, error: error.message },
        'Redis unavailable proceeding without lock',
      );
    }

    if (!lockAcquired) {
      return;
    }

    try {
      this.logger.log(
        { user: user.uuid },
        'Starting async empty trash operation for user',
      );

      await this.trashUseCases.performTrashDeletion(
        user,
        trashedFilesNumber,
        trashedFoldersNumber,
        1000,
      );

      this.logger.log(
        'Succesfully completed async empty trash operation for user',
      );
    } catch (error) {
      this.logger.error(
        {
          user: user.uuid,
          trashedFiles: trashedFilesNumber,
          trashedFolders: trashedFoldersNumber,
          error: (error as Error).message,
        },
        'Failed to complete async empty trash operation',
      );
    } finally {
      await this.redisService.releaseLock(lockKey).catch((error) => {
        this.logger.warn(
          { user: user.uuid, error: error.message },
          'Failed to release lock',
        );
      });
    }
  }
}
