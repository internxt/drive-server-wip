export class FolderDto {
  id: number;
  parent?: FolderDto;
  name: string;
  bucket: string;
  uuid: string;
  userId: number;
  encryptVersion: '03-aes';
  plainName: string;
  size: number;
  deleted: boolean;
  deletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
