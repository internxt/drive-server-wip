import { Injectable, Logger } from '@nestjs/common';
import { SequelizeFileVersionRepository } from '../file-version.repository';
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
    let resultCount = 0;

    do {
      const versionIds =
        await this.fileVersionRepository.findExpiredVersionIdsByTierLimits(
          batchSize,
        );

      resultCount = versionIds.length;

      if (resultCount > 0) {
        yield versionIds;
      }
    } while (resultCount === batchSize);
  }
}
