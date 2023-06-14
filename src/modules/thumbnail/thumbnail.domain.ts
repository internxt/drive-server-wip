import { FileAttributes } from '../file/file.domain';
import { ThumbnailAttributes } from './thumbnail.attributes';

export class Thumbnail implements ThumbnailAttributes {
  id: number;
  fileId: number;
  type: string;
  size: number;
  bucket_id: string;
  bucket_file: string;
  encrypt_version: string;
  created_at: Date;
  updated_at: Date;
  max_width: number;
  max_height: number;

  constructor(attributes: ThumbnailAttributes) {
    this.id = attributes.id;
    this.fileId = attributes.fileId;
    this.type = attributes.type;
    this.size = attributes.size;
    this.bucket_id = attributes.bucket_id;
    this.bucket_file = attributes.bucket_file;
    this.encrypt_version = attributes.encrypt_version;
    this.created_at = attributes.created_at;
    this.updated_at = attributes.updated_at;
  }

  static build(thumbnail: ThumbnailAttributes): Thumbnail {
    return new Thumbnail(thumbnail);
  }
}
