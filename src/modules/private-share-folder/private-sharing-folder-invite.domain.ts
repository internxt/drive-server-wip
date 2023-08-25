import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';

export interface PrivateSharingFolderInviteAttributes {
  id: string;
  folderId: Folder['uuid'];
  ownerId: User['uuid'];
  sharedWith: User['uuid'];
  encryptionKey: string;
  folder?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PrivateSharingFolderInvite
  implements PrivateSharingFolderInviteAttributes
{
  id: string;
  folderId: Folder['uuid'];
  ownerId: User['uuid'];
  sharedWith: User['uuid'];
  encryptionKey: string;
  folder?: Folder;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(attributes: PrivateSharingFolderInviteAttributes) {
    this.id = attributes.id;
    this.folderId = attributes.folderId;
    this.ownerId = attributes.ownerId;
    this.sharedWith = attributes.sharedWith;
    this.encryptionKey = attributes.encryptionKey;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
    this.folder = attributes.folder;
  }

  static build(
    privateShareFolderInvite: PrivateSharingFolderInviteAttributes,
  ): PrivateSharingFolderInvite {
    return new PrivateSharingFolderInvite(privateShareFolderInvite);
  }
}
