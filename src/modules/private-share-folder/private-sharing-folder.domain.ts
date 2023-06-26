export interface PrivateSharingFolderAttributes {
  id: string;
  folderUuid: string;
  ownerUuid: string;
  sharedWithUuid: string;
  encryptedKey: string;
}

export class PrivateSharingFolder implements PrivateSharingFolderAttributes {
  id: string;
  folderUuid: string;
  ownerUuid: string;
  sharedWithUuid: string;
  encryptedKey: string;

  constructor(attributes: PrivateSharingFolderAttributes) {
    this.id = attributes.id;
    this.folderUuid = attributes.folderUuid;
    this.ownerUuid = attributes.ownerUuid;
    this.sharedWithUuid = attributes.sharedWithUuid;
    this.encryptedKey = attributes.encryptedKey;
  }

  static build(
    privateShareFolder: PrivateSharingFolderAttributes,
  ): PrivateSharingFolder {
    return new PrivateSharingFolder(privateShareFolder);
  }
}
