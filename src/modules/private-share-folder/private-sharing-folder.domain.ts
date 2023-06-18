export interface PrivateSharingFolderAttributes {
  id: string;
  folderId: number;
  folderUuid: string;
  ownerId: number;
  ownerUuid: string;
  sharedWithId: number;
  sharedWithUuid: string;
  encryptedKey: string;
}

export class PrivateSharingFolder implements PrivateSharingFolderAttributes {
  id: string;
  folderId: number;
  folderUuid: string;
  ownerId: number;
  ownerUuid: string;
  sharedWithId: number;
  sharedWithUuid: string;
  encryptedKey: string;

  constructor(attributes: PrivateSharingFolderAttributes) {
    this.id = attributes.id;
    this.folderId = attributes.folderId;
    this.folderUuid = attributes.folderUuid;
    this.ownerId = attributes.ownerId;
    this.ownerUuid = attributes.ownerUuid;
    this.sharedWithId = attributes.sharedWithId;
    this.sharedWithUuid = attributes.sharedWithUuid;
    this.encryptedKey = attributes.encryptedKey;
  }

  static build(
    privateShareFolder: PrivateSharingFolderAttributes,
  ): PrivateSharingFolder {
    return new PrivateSharingFolder(privateShareFolder);
  }
}
