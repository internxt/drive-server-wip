import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SequelizeFileVersionRepository } from '../file-version.repository';
import { SequelizeFileRepository } from '../file.repository';
import { User } from '../../user/user.domain';
import { FileVersionStatus } from '../file-version.domain';
import { File } from '../file.domain';

@Injectable()
export class RestoreFileVersionAction {
  constructor(
    private readonly fileRepository: SequelizeFileRepository,
    private readonly fileVersionRepository: SequelizeFileVersionRepository,
  ) {}

  async execute(
    user: User,
    fileUuid: string,
    versionId: string,
  ): Promise<File> {
    const file = await this.fileRepository.findByUuid(fileUuid, user.id, {});

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const versionToRestore =
      await this.fileVersionRepository.findById(versionId);

    if (!versionToRestore) {
      throw new NotFoundException('Version not found');
    }

    if (versionToRestore.fileId !== fileUuid) {
      throw new ConflictException('Version does not belong to this file');
    }

    if (versionToRestore.status !== FileVersionStatus.EXISTS) {
      throw new BadRequestException('Cannot restore a deleted version');
    }

    const allVersions =
      await this.fileVersionRepository.findAllByFileId(fileUuid);

    const newerVersions = allVersions.filter(
      (v) =>
        v.createdAt > versionToRestore.createdAt &&
        v.status === FileVersionStatus.EXISTS,
    );

    const idsToDelete = [
      ...newerVersions.map((v) => v.id),
      versionToRestore.id,
    ];

    await Promise.all([
      this.fileVersionRepository.updateStatusBatch(
        idsToDelete,
        FileVersionStatus.DELETED,
      ),
      this.fileRepository.updateByUuidAndUserId(fileUuid, user.id, {
        fileId: versionToRestore.networkFileId,
        size: versionToRestore.size,
        updatedAt: new Date(),
      }),
    ]);

    file.fileId = versionToRestore.networkFileId;
    file.size = versionToRestore.size;

    return file;
  }
}
