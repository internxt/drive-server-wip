export interface PrivateSharingFolderAttributes {
  id: string;
  folderId: string;
  ownerId: string;
  sharedWith: string[];
  encruptedKey: string;
}

export class PrivateShararingFolder implements PrivateSharingFolderAttributes {
  id: string;
  folderId: string;
  ownerId: string;
  sharedWith: string[];
  encruptedKey: string;

  constructor(attributes: PrivateSharingFolderAttributes) {
    this.id = attributes.id;
    this.folderId = attributes.folderId;
    this.ownerId = attributes.ownerId;
    this.sharedWith = attributes.sharedWith;
    this.encruptedKey = attributes.encruptedKey;
  }

  static build(
    privateShareFolder: PrivateSharingFolderAttributes,
  ): PrivateShararingFolder {
    return new PrivateShararingFolder(privateShareFolder);
  }
}
