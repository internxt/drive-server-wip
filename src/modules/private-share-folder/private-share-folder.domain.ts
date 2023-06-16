export interface PrivateShareFolderAttributes {
  id: string;
  folderId: string;
  ownerId: string;
  sharedWith: string[];
  encruptedKey: string;
}

export class PrivateShareFolder implements PrivateShareFolderAttributes {
  id: string;
  folderId: string;
  ownerId: string;
  sharedWith: string[];
  encruptedKey: string;

  constructor(attributes: PrivateShareFolderAttributes) {
    this.id = attributes.id;
    this.folderId = attributes.folderId;
    this.ownerId = attributes.ownerId;
    this.sharedWith = attributes.sharedWith;
    this.encruptedKey = attributes.encruptedKey;
  }

  static build(
    privateShareFolder: PrivateShareFolderAttributes,
  ): PrivateShareFolder {
    return new PrivateShareFolder(privateShareFolder);
  }
}
