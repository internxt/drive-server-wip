import { Sharing } from '../sharing/sharing.domain';

export interface FolderAttributes {
  id: number;
  parentId: number;
  parentUuid?: string;
  parent?: any;
  name?: string;
  bucket: string;
  userId: number;
  uuid: string;
  user?: any;
  plainName: string;
  encryptVersion: '03-aes';
  deleted: boolean;
  removed: boolean;
  deletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  removedAt: Date;
  creationTime: Date;
  modificationTime: Date;
  sharings?: Sharing[];
}
