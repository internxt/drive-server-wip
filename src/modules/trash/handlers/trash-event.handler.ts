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

    const lockAdquired = await this.redisService.tryAcquireLock(
      lockKey,
      1000 * 2,
    );

    if (!lockAdquired) {
      return;
    }

    try {
      this.logger.log(
        `Starting async empty trash operation for user: ${user.uuid}`,
      );

      await this.trashUseCases.performTrashDeletion(
        user,
        trashedFilesNumber,
        trashedFoldersNumber,
        1000,
      );

      this.logger.log(
        `Successfully completed empty trash operation for user: ${user.uuid}`,
      );
    } catch (error) {
      this.logger.error(
        `[TRASH/EMPTY_TRASH_ASYNC] ERROR: ${
          (error as Error).message
        } USER: ${JSON.stringify({
          uuid: user.uuid,
          email: user.email,
        })} STACK: ${(error as Error).stack}`,
      );
    } finally {
      try {
        await this.redisService.releaseLock(lockKey);
        this.logger.log(`Released lock for user: ${user.uuid}`);
      } catch (lockError) {
        this.logger.error(
          `Failed to release lock for user: ${user.uuid}, error: ${(lockError as Error).message}`,
        );
      }
    }
  }
}
