import { Injectable, Logger } from '@nestjs/common';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { User } from '../user/user.domain';
import { SequelizeThumbnailRepository } from './thumbnail.repository';
import { CreateThumbnailDto } from './dto/create-thumbnail.dto';
import { ThumbnailAttributes } from './thumbnail.attributes';
import { Thumbnail } from './thumbnail.domain';

@Injectable()
export class ThumbnailUseCases {
  constructor(
    private thumbnailRepository: SequelizeThumbnailRepository,
    private network: BridgeService,
  ) {}
  async createThumbnail(user: User, thumbnail: CreateThumbnailDto) {
    const exists = await this.thumbnailRepository.findByFileId(
      thumbnail.fileId,
    );
    if (exists) {
      try {
        await this.network.deleteFile(
          user,
          thumbnail.bucketId,
          exists.bucketFile,
        );
      } catch (error) {
        Logger.error(
          `[THUMBNAIL/CREATE] Error deleting existent thumbnail. Error: ${error.message}`,
        );
      }
      await this.thumbnailRepository.update(thumbnail, {
        id: exists.id,
        fileId: exists.fileId,
      });
      return this.thumbnailRepository.findByFileId(thumbnail.fileId);
    }

    return this.thumbnailRepository.create({
      ...thumbnail,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  async findAll(where: Partial<ThumbnailAttributes>): Promise<Thumbnail[]> {
    return this.thumbnailRepository.findAll(where);
  }
  async deleteBy(where: Partial<ThumbnailAttributes>): Promise<void> {
    return this.thumbnailRepository.deleteBy(where);
  }
}
