import { Sharing } from '../../../sharing/sharing.domain';

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
  removed: boolean;
  deleted: boolean;
  removedAt: Date;
  deletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  sharings?: Sharing[];
}
