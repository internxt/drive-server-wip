import { Injectable } from '@nestjs/common';
import { User } from '../../user/user.domain';
import { File } from '../file.domain';
import { SequelizeFileRepository } from '../file.repository';
import { SequelizeFileVersionRepository } from '../file-version.repository';
import { FileVersionStatus } from '../file-version.domain';
import { FeatureLimitService } from '../../feature-limit/feature-limit.service';
import { Time } from '../../../lib/time';

@Injectable()
export class CreateFileVersionAction {
  constructor(
    private readonly fileRepository: SequelizeFileRepository,
    private readonly fileVersionRepository: SequelizeFileVersionRepository,
    private readonly featureLimitService: FeatureLimitService,
  ) {}

  async execute(
    user: User,
    file: File,
    newFileId: string | null,
    newSize: bigint,
    modificationTime?: Date,
  ): Promise<void> {
    await this.applyRetentionPolicy(file.uuid, user.uuid);

    await Promise.all([
      this.fileVersionRepository.create({
        fileId: file.uuid,
        userId: user.uuid,
        networkFileId: file.fileId,
        size: file.size,
        status: FileVersionStatus.EXISTS,
      }),
      this.fileRepository.updateByUuidAndUserId(file.uuid, user.id, {
        fileId: newFileId,
        size: newSize,
        updatedAt: new Date(),
        ...(modificationTime ? { modificationTime } : null),
      }),
    ]);
  }

  private async applyRetentionPolicy(
    fileUuid: string,
    userUuid: string,
  ): Promise<void> {
    const limits =
      await this.featureLimitService.getFileVersioningLimits(userUuid);

    const { retentionDays, maxVersions } = limits;

    const cutoffDate = Time.daysAgo(retentionDays);

    const versions = await this.fileVersionRepository.findAllByFileId(fileUuid);

    const versionsToDeleteByAge = versions.filter(
      (version) => version.createdAt < cutoffDate,
    );

    const remainingVersions = versions
      .filter((version) => version.createdAt >= cutoffDate)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const versionsToDeleteByCount = remainingVersions.slice(maxVersions);

    const versionsToDelete = [
      ...versionsToDeleteByAge,
      ...versionsToDeleteByCount,
    ];

    if (remainingVersions.length === maxVersions) {
      const oldestVersion = remainingVersions.at(-1);
      versionsToDelete.push(oldestVersion);
    }

    if (versionsToDelete.length > 0) {
      const idsToDelete = versionsToDelete.map((v) => v.id);
      await this.fileVersionRepository.updateStatusBatch(
        idsToDelete,
        FileVersionStatus.DELETED,
      );
    }
  }
}
