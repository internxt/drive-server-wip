import { PrivateSharingFolder } from '../private-share-folder/private-sharing-folder.domain';
import { Share } from '../share/share.domain';
import { SharingModel } from '../sharing/models';

export interface FolderAttributes {
  id: number;
  parentId: number;
  parent?: any;
  name: string;
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
  shares?: Share[];
  privateShares?: SharingModel[];
}
