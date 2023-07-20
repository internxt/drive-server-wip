import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';

export interface PrivateSharingFolderAttributes {
  id: string;
  folderId: Folder['uuid'];
  ownerId: User['uuid'];
  sharedWith: User['uuid'];
  encryptionKey: string;
}

export class PrivateSharingFolder implements PrivateSharingFolderAttributes {
  id: string;
  folderId: Folder['uuid'];
  ownerId: User['uuid'];
  sharedWith: User['uuid'];
  encryptionKey: string;

  constructor(attributes: PrivateSharingFolderAttributes) {
    this.id = attributes.id;
    this.folderId = attributes.folderId;
    this.ownerId = attributes.ownerId;
    this.sharedWith = attributes.sharedWith;
    this.encryptionKey = attributes.encryptionKey;
  }

  static build(
    privateShareFolder: PrivateSharingFolderAttributes,
  ): PrivateSharingFolder {
    return new PrivateSharingFolder(privateShareFolder);
  }
}
