import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';

export interface PrivateSharingFolderAttributes {
  id: string;
  folderId: Folder['uuid'];
  ownerId: User['uuid'];
  sharedWith: User['uuid'];
  encryptionKey: string;
  folder?: any;
  createdAt?: Date;
}

export class PrivateSharingFolder implements PrivateSharingFolderAttributes {
  id: string;
  folderId: Folder['uuid'];
  ownerId: User['uuid'];
  sharedWith: User['uuid'];
  encryptionKey: string;
  folder?: Folder;
  createdAt?: Date;

  constructor(attributes: PrivateSharingFolderAttributes) {
    this.id = attributes.id;
    this.folderId = attributes.folderId;
    this.ownerId = attributes.ownerId;
    this.sharedWith = attributes.sharedWith;
    this.encryptionKey = attributes.encryptionKey;
    this.createdAt = attributes.createdAt;
    this.setFolder(attributes.folder);
  }

  static build(
    privateShareFolder: PrivateSharingFolderAttributes,
  ): PrivateSharingFolder {
    return new PrivateSharingFolder(privateShareFolder);
  }

  setFolder(folder) {
    if (folder && !(folder instanceof Folder)) {
      throw Error('folder invalid');
    }
    this.folder = folder;
  }
}
