export class FolderDto {
  id: number;
  parent?: FolderDto;
  name: string;
  bucket: string;
  userId: number;
  encryptVersion: '03-aes';
  size: number;
  deleted: boolean;
  deletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
