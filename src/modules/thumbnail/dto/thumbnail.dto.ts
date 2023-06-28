export class ThumbnailDto {
  id: number;
  fileId: number;
  type: string;
  size: number;
  bucketId: string;
  bucketFile: string;
  encryptVersion: string;
  createdAt: Date;
  updatedAt: Date;
  maxWidth: number;
  maxHeight: number;
}
