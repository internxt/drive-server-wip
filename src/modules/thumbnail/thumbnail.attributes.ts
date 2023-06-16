export interface ThumbnailAttributes {
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
}
