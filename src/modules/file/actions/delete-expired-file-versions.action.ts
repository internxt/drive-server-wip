import { Injectable, Logger } from '@nestjs/common';
import {
  type ExpiredVersionsCursor,
  SequelizeFileVersionRepository,
} from '../file-version.repository';
import { FileVersionStatus } from '../file-version.domain';

@Injectable()
export class DeleteExpiredFileVersionsAction {
  private readonly logger = new Logger(DeleteExpiredFileVersionsAction.name);

  constructor(
    private readonly fileVersionRepository: SequelizeFileVersionRepository,
  ) {}

  async execute(options?: {
    batchSize?: number;
  }): Promise<{ deletedCount: number }> {
    const batchSize = options?.batchSize ?? 100;
    let totalDeleted = 0;

    for await (const versionIds of this.yieldExpiredVersionIds(batchSize)) {
      this.logger.log(
        `Found ${versionIds.length} expired versions to mark as DELETED`,
      );

      await this.fileVersionRepository.updateStatusBatch(
        versionIds,
        FileVersionStatus.DELETED,
      );

      totalDeleted += versionIds.length;

      this.logger.log(
        `Marked ${versionIds.length} versions as DELETED. Total: ${totalDeleted}`,
      );
    }

    return { deletedCount: totalDeleted };
  }

  private async *yieldExpiredVersionIds(batchSize: number) {
    let cursor: ExpiredVersionsCursor | undefined;
    let hasMore = false;

    do {
      const versions =
        await this.fileVersionRepository.findExpiredVersionIdsByTierLimits(
          batchSize + 1,
          cursor,
        );

      hasMore = versions.length > batchSize;
      const batch = versions.slice(0, batchSize);

      if (batch.length > 0) {
        const last = batch[batch.length - 1];
        cursor = { userId: last.userId, createdAt: last.createdAt };
        yield batch.map((version) => version.id);
      }
    } while (hasMore);
  }
}
