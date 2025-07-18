export interface ThumbnailAttributes {
  id: number;
  fileId: number;
  fileUuid: string;
  type: string;
  size: number;
  bucket_id?: string;
  bucket_file?: string;
  bucketId: string;
  bucketFile: string;
  encryptVersion: string;
  createdAt: Date;
  updatedAt: Date;
  maxWidth: number;
  maxHeight: number;
}
