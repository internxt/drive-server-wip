import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SequelizeFileVersionRepository } from '../file-version.repository';

export interface UndoOptions {
  batchSize?: number;
  limits?: {
    retentionDays: number;
    maxVersions: number;
  };
}

@Injectable()
export class UndoFileVersioningAction {
  constructor(
    private readonly fileVersionRepository: SequelizeFileVersionRepository,
  ) {}

  async execute(
    userUuid: string,
    options?: UndoOptions,
  ): Promise<{ deletedCount: number }> {
    const batchSize = options?.batchSize ?? 1000;

    if (!options?.limits) {
      return this.executeUndo(userUuid, batchSize);
    }

    return this.executePartialUndo(
      userUuid,
      batchSize,
      options.limits.retentionDays,
      options.limits.maxVersions,
    );
  }

  private async executeUndo(
    userUuid: string,
    batchSize: number,
  ): Promise<{ deletedCount: number }> {
    return this.processBatchesWithRetry(userUuid, batchSize, () =>
      this.fileVersionRepository.deleteUserVersionsBatch(userUuid, batchSize),
    );
  }

  private async executePartialUndo(
    userUuid: string,
    batchSize: number,
    retentionDays: number,
    maxVersions: number,
  ): Promise<{ deletedCount: number }> {
    return this.processBatchesWithRetry(userUuid, batchSize, () =>
      this.fileVersionRepository.deleteUserVersionsByLimits(
        userUuid,
        retentionDays,
        maxVersions,
        batchSize,
      ),
    );
  }

  private async processBatchesWithRetry(
    userUuid: string,
    batchSize: number,
    deleteFn: () => Promise<number>,
  ): Promise<{ deletedCount: number }> {
    const maxRetries = 3;
    let totalDeleted = 0;
    let processedCount: number;

    do {
      let retries = 0;
      let success = false;

      while (!success && retries < maxRetries) {
        try {
          processedCount = await deleteFn();
          totalDeleted += processedCount;
          success = true;
        } catch (error) {
          retries++;
          if (retries < maxRetries) {
            Logger.warn(
              `[FILE_VERSION/UNDO] Batch deletion failed, retry ${retries}/${maxRetries} for user ${userUuid}`,
              error,
            );
            await this.delay(1000 * retries);
          } else {
            Logger.error(
              `[FILE_VERSION/UNDO] Batch deletion failed after ${maxRetries} retries for user ${userUuid}. Successfully deleted ${totalDeleted} versions before failure. Error: ${error.message}`,
              error,
            );
            throw new InternalServerErrorException(
              `Failed to complete version cleanup. Successfully deleted ${totalDeleted} versions before failure.`,
            );
          }
        }
      }
    } while (processedCount === batchSize);

    return { deletedCount: totalDeleted };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
