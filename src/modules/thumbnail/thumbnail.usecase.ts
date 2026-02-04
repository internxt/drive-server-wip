import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { User } from '../user/user.domain';
import { SequelizeThumbnailRepository } from './thumbnail.repository';
import { CreateThumbnailDto } from './dto/create-thumbnail.dto';
import { ThumbnailAttributes } from './thumbnail.attributes';
import { Thumbnail } from './thumbnail.domain';
import { SequelizeFileRepository } from '../file/file.repository';

@Injectable()
export class ThumbnailUseCases {
  constructor(
    private readonly thumbnailRepository: SequelizeThumbnailRepository,
    private readonly network: BridgeService,
    private readonly fileRepository: SequelizeFileRepository,
  ) {}
  async createThumbnail(user: User, thumbnail: CreateThumbnailDto) {
    const searchCondition: { id: number } | { uuid: string } =
      thumbnail.fileUuid
        ? { uuid: thumbnail.fileUuid }
        : { id: thumbnail.fileId };

    const file = await this.fileRepository.findOneBy(searchCondition);
    if (!file) {
      throw new NotFoundException('File not found');
    }
    if (file.userId !== user.id) {
      throw new ForbiddenException(
        'You do not have permission to modify this file',
      );
    }
    const bucketId = file.bucket;
    const existingThumbnail = await this.thumbnailRepository.findByFileUuid(
      file.uuid,
    );
    if (existingThumbnail) {
      try {
        await this.network.deleteFile(
          user,
          existingThumbnail.bucketId,
          existingThumbnail.bucketFile,
        );
      } catch (error) {
        Logger.error(
          `[THUMBNAIL/CREATE] Error deleting existent thumbnail. Error: ${error.message}`,
        );
      }
      await this.thumbnailRepository.update(
        { ...thumbnail, bucketId },
        {
          id: existingThumbnail.id,
          fileUuid: existingThumbnail.fileUuid,
        }
      );
      return this.thumbnailRepository.findByFileUuid(file.uuid);
    }

    const newThumbnailObject = {
      ...thumbnail,
      bucketId,
      fileId: file.id,
      fileUuid: file.uuid,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.thumbnailRepository.create(newThumbnailObject);
  }

  async deleteThumbnailByFileUuid(user: User, fileUuid: string) {
    const thumbnail = await this.thumbnailRepository.findByFileUuid(fileUuid);
    if (!thumbnail) {
      return;
    }
    await this.network.deleteFile(
      user,
      thumbnail.bucket_id,
      thumbnail.bucket_file,
    );
    await this.thumbnailRepository.deleteBy({ fileUuid });
  }

  async findAll(where: Partial<ThumbnailAttributes>): Promise<Thumbnail[]> {
    return this.thumbnailRepository.findAll(where);
  }

  async deleteBy(where: Partial<ThumbnailAttributes>): Promise<void> {
    return this.thumbnailRepository.deleteBy(where);
  }
}
