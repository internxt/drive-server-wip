import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ThumbnailModel } from './thumbnail.model';
import { type Thumbnail } from './thumbnail.domain';
import { type FileAttributes } from '../file/file.domain';
import { type ThumbnailAttributes } from './thumbnail.attributes';

interface ThumbnailRepository {
  findById(id: Thumbnail['id']): Promise<Thumbnail | null>;
  findByFileUuid(fileUuid: FileAttributes['uuid']): Promise<Thumbnail | null>;
  findAll(where?: Partial<ThumbnailAttributes>): Promise<Thumbnail[]>;
  create(thumbnail: Omit<ThumbnailAttributes, 'id'>): Promise<Thumbnail>;
  update(
    thumbnail: Partial<Thumbnail>,
    where: Partial<Thumbnail>,
  ): Promise<void>;
  deleteById(id: Thumbnail['id']): Promise<void>;
  deleteBy(where: Partial<Thumbnail>): Promise<void>;
}

@Injectable()
export class SequelizeThumbnailRepository implements ThumbnailRepository {
  constructor(
    @InjectModel(ThumbnailModel)
    private readonly thumbnailModel: typeof ThumbnailModel,
  ) {}

  async findById(id: number): Promise<Thumbnail | null> {
    const thumbnail = await this.thumbnailModel.findByPk(id);
    return thumbnail ? this.toDomain(thumbnail) : null;
  }

  async findByFileUuid(
    fileUuid: FileAttributes['uuid'],
  ): Promise<Thumbnail | null> {
    const thumbnail = await this.thumbnailModel.findOne({
      where: { file_uuid: fileUuid },
    });
    return thumbnail ? this.toDomain(thumbnail) : null;
  }

  async findAll(where?: Partial<ThumbnailAttributes>): Promise<Thumbnail[]> {
    const thumbnails = await this.thumbnailModel.findAll({ where });
    return thumbnails.map(this.toDomain.bind(this));
  }

  async create(
    newThumbnail: Omit<ThumbnailAttributes, 'id'>,
  ): Promise<Thumbnail> {
    const thumbnail = await this.thumbnailModel.create(newThumbnail);
    return this.toDomain(thumbnail);
  }

  async update(
    thumbnail: Partial<Thumbnail>,
    where: Partial<Thumbnail>,
  ): Promise<void> {
    await this.thumbnailModel.update(thumbnail, {
      where,
    });
  }

  async deleteById(id: number): Promise<void> {
    await this.thumbnailModel.destroy({ where: { id } });
  }

  async deleteBy(where: Partial<Thumbnail>): Promise<void> {
    await this.thumbnailModel.destroy({ where });
  }

  private toDomain(model: ThumbnailModel): Thumbnail {
    return {
      id: model.id,
      fileId: model.fileId,
      fileUuid: model.fileUuid,
      type: model.type,
      size: model.size,
      bucketId: model.bucketId,
      bucketFile: model.bucketFile,
      encryptVersion: model.encryptVersion,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      maxWidth: model.maxWidth,
      maxHeight: model.maxHeight,
    };
  }

  private toModel(thumbnail: Thumbnail): Partial<ThumbnailModel> {
    return {
      id: thumbnail.id,
      fileId: thumbnail.fileId,
      fileUuid: thumbnail.fileUuid,
      type: thumbnail.type,
      size: thumbnail.size,
      bucketId: thumbnail.bucket_id,
      bucketFile: thumbnail.bucket_file,
      encryptVersion: thumbnail.encryptVersion,
      createdAt: thumbnail.createdAt,
      updatedAt: thumbnail.updatedAt,
      maxWidth: thumbnail.maxWidth,
      maxHeight: thumbnail.maxHeight,
    };
  }
}
