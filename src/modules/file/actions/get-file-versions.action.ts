import { Injectable, NotFoundException } from '@nestjs/common';
import { SequelizeFileVersionRepository } from '../file-version.repository';
import { SequelizeFileRepository } from '../file.repository';
import { FeatureLimitService } from '../../feature-limit/feature-limit.service';
import { User } from '../../user/user.domain';
import { FileVersionDto } from '../dto/responses/file-version.dto';

@Injectable()
export class GetFileVersionsAction {
  constructor(
    private readonly fileRepository: SequelizeFileRepository,
    private readonly fileVersionRepository: SequelizeFileVersionRepository,
    private readonly featureLimitService: FeatureLimitService,
  ) {}

  async execute(user: User, fileUuid: string): Promise<FileVersionDto[]> {
    const file = await this.fileRepository.findByUuid(fileUuid, user.id, {});

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const [versions, limits] = await Promise.all([
      this.fileVersionRepository.findAllByFileId(fileUuid),
      this.featureLimitService.getFileVersioningLimits(user.uuid),
    ]);

    const { retentionDays } = limits;

    return versions.map((version) => {
      const expiresAt = new Date(version.createdAt);
      expiresAt.setDate(expiresAt.getDate() + retentionDays);

      return {
        ...version.toJSON(),
        expiresAt,
      };
    });
  }
}
