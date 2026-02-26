import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SequelizeFileVersionRepository } from '../file-version.repository';
import { SequelizeFileRepository } from '../file.repository';
import { type User } from '../../user/user.domain';
import { FileVersionStatus } from '../file-version.domain';
import { UsageInvalidatedEvent } from '../../usage-queue/events/usage-invalidated.event';

@Injectable()
export class DeleteFileVersionAction {
  constructor(
    private readonly fileRepository: SequelizeFileRepository,
    private readonly fileVersionRepository: SequelizeFileVersionRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    user: User,
    fileUuid: string,
    versionId: string,
  ): Promise<void> {
    const file = await this.fileRepository.findByUuid(fileUuid, user.id, {});

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (!file.isOwnedBy(user)) {
      throw new ForbiddenException('You do not own this file');
    }

    const version = await this.fileVersionRepository.findById(versionId);

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    if (version.fileId !== fileUuid) {
      throw new ConflictException('Version does not belong to this file');
    }

    await this.fileVersionRepository.updateStatus(
      versionId,
      FileVersionStatus.DELETED,
    );

    this.eventEmitter.emit(
      'usage.file.version_deleted',
      new UsageInvalidatedEvent(user.uuid, user.id, 'file.version.delete'),
    );
  }
}
