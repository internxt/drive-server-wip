import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ThumbnailModel } from './thumbnail.model';
import { Thumbnail } from './thumbnail.domain';
import { FileAttributes } from '../file/file.domain';

export interface ThumbnailRepository {
  findById(id: number): Promise<Thumbnail | null>;
  findByFileId(fileId: FileAttributes['id']): Promise<Thumbnail | null>;
  findAll(): Promise<Thumbnail[]>;
  create(thumbnail: Thumbnail): Promise<Thumbnail>;
  update(thumbnail: Thumbnail): Promise<void>;
  deleteById(id: number): Promise<void>;
}

@Injectable()
export class SequelizeThumbnailRepository implements ThumbnailRepository {
  constructor(
    @InjectModel(ThumbnailModel)
    private thumbnailModel: typeof ThumbnailModel,
  ) {}

  async findById(id: number): Promise<Thumbnail | null> {
    const thumbnail = await this.thumbnailModel.findByPk(id);
    return thumbnail ? this.toDomain(thumbnail) : null;
  }

  async findByFileId(fileId: FileAttributes['id']): Promise<Thumbnail | null> {
    const thumbnail = await this.thumbnailModel.findOne({
      where: { file_id: fileId },
    });
    return thumbnail ? this.toDomain(thumbnail) : null;
  }

  async findAll(): Promise<Thumbnail[]> {
    const thumbnails = await this.thumbnailModel.findAll();
    return thumbnails.map(this.toDomain.bind(this));
  }

  async create(thumbnail: Thumbnail): Promise<Thumbnail> {
    const thumbnailModel = this.toModel(thumbnail);
    const createdThumbnail = await this.thumbnailModel.create(thumbnailModel);
    return this.toDomain(createdThumbnail);
  }

  async update(thumbnail: Thumbnail): Promise<void> {
    const thumbnailModel = await this.thumbnailModel.findByPk(thumbnail.id);
    if (!thumbnailModel) {
      throw new Error(`Thumbnail with ID ${thumbnail.id} not found`);
    }
    thumbnailModel.set(this.toModel(thumbnail));
    await thumbnailModel.save();
  }

  async deleteById(id: number): Promise<void> {
    await this.thumbnailModel.destroy({ where: { id } });
  }

  private toDomain(model: ThumbnailModel): Thumbnail {
    return {
      id: model.id,
      fileId: model.fileId,
      type: model.type,
      size: model.size,
      bucket_id: model.bucket_id,
      bucket_file: model.bucket_file,
      encrypt_version: model.encrypt_version,
      created_at: model.created_at,
      updated_at: model.updated_at,
      max_width: model.max_width,
      max_height: model.max_height,
    };
  }

  private toModel(thumbnail: Thumbnail): Partial<ThumbnailModel> {
    return {
      id: thumbnail.id,
      fileId: thumbnail.fileId,
      type: thumbnail.type,
      size: thumbnail.size,
      bucket_id: thumbnail.bucket_id,
      bucket_file: thumbnail.bucket_file,
      encrypt_version: thumbnail.encrypt_version,
      created_at: thumbnail.created_at,
      updated_at: thumbnail.updated_at,
      max_width: thumbnail.max_width,
      max_height: thumbnail.max_height,
    };
  }
}
