import { ThumbnailAttributes } from './thumbnail.attributes';

export class Thumbnail implements ThumbnailAttributes {
  id: number;
  fileId: number;
  type: string;
  size: number;
  bucket_id: string;
  bucket_file: string;
  encryptVersion: string;
  createdAt: Date;
  updatedAt: Date;
  maxWidth: number;
  maxHeight: number;

  constructor(attributes: ThumbnailAttributes) {
    this.id = attributes.id;
    this.fileId = attributes.fileId;
    this.type = attributes.type;
    this.size = attributes.size;
    this.bucket_id = attributes.bucket_id;
    this.bucket_file = attributes.bucket_file;
    this.encryptVersion = attributes.encryptVersion;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
    this.maxWidth = attributes.maxWidth;
    this.maxHeight = attributes.maxHeight;
  }

  static build(thumbnail: ThumbnailAttributes): Thumbnail {
    return new Thumbnail(thumbnail);
  }
}
