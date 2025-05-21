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
import { SequelizeFileRepository } from '../storage/file/file.repository';

@Injectable()
export class ThumbnailUseCases {
  constructor(
    private thumbnailRepository: SequelizeThumbnailRepository,
    private network: BridgeService,
    private fileRepository: SequelizeFileRepository,
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
    const existingThumbnail = await this.thumbnailRepository.findByFileId(
      file.id,
    );
    if (existingThumbnail) {
      try {
        await this.network.deleteFile(
          user,
          thumbnail.bucketId,
          existingThumbnail.bucketFile,
        );
      } catch (error) {
        Logger.error(
          `[THUMBNAIL/CREATE] Error deleting existent thumbnail. Error: ${error.message}`,
        );
      }
      await this.thumbnailRepository.update(thumbnail, {
        id: existingThumbnail.id,
        fileId: existingThumbnail.fileId,
      });
      return this.thumbnailRepository.findByFileId(file.id);
    }

    const newThumbnailObject = {
      ...thumbnail,
      fileId: file.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.thumbnailRepository.create(newThumbnailObject);
  }

  async deleteThumbnailByFileId(user: User, fileId: number) {
    const thumbnail = await this.thumbnailRepository.findByFileId(fileId);
    if (!thumbnail) {
      return;
    }
    await this.network.deleteFile(
      user,
      thumbnail.bucket_id,
      thumbnail.bucket_file,
    );
    await this.thumbnailRepository.deleteBy({ fileId });
  }

  async findAll(where: Partial<ThumbnailAttributes>): Promise<Thumbnail[]> {
    return this.thumbnailRepository.findAll(where);
  }

  async deleteBy(where: Partial<ThumbnailAttributes>): Promise<void> {
    return this.thumbnailRepository.deleteBy(where);
  }
}
