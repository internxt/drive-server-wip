import { aes } from '@internxt/lib';

import { File, FileAttributes } from '../file/file.domain';
import { Folder, FolderAttributes } from '../folder/folder.domain';
import { UserAttributes } from '../user/user.domain';

export interface ShareAttributes {
  id: number;
  token: string;
  mnemonic: string;
  bucket: FileAttributes['bucket'];
  isFolder: boolean;
  views: number;
  timesValid: number;
  userId: UserAttributes['id'];
  fileId: FileAttributes['id'];
  fileSize: FileAttributes['size'];
  folderId: FolderAttributes['id'];
  active: boolean;
  code: string;
  createdAt: Date;
  updatedAt: Date;
  fileToken: string;
  hashedPassword?: string;
}

export class Share implements ShareAttributes {
  id: number;
  token: string;
  mnemonic: string;
  bucket: string;
  isFolder: boolean;
  views: number;
  timesValid: number;
  userId: UserAttributes['id'];
  fileId: FileAttributes['id'];
  fileSize: FileAttributes['size'];
  folderId: FolderAttributes['id'];
  active: boolean;
  code: string;
  item: File | Folder;
  fileToken: string;
  createdAt: Date;
  updatedAt: Date;
  hashedPassword: string | null;

  constructor({
    id,
    token,
    mnemonic,
    user,
    item,
    encryptionKey,
    bucket,
    itemToken,
    isFolder,
    views,
    timesValid,
    active,
    createdAt,
    updatedAt,
    hashedPassword = null,
  }) {
    this.id = id;
    this.token = token;
    this.mnemonic = mnemonic;
    this.setUser(user);
    this.item = item;
    this.encryptionKey = encryptionKey;
    this.bucket = bucket;
    this.itemToken = itemToken;
    this.isFolder = isFolder;
    this.views = views;
    this.timesValid = timesValid;
    this.active = active;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.hashedPassword = hashedPassword;
  }

  static build(share: ShareAttributes): Share {
    return new Share(share);
  }

  incrementView() {
    this.views += 1;
  }

  canHaveView() {
    return (
      this.active && (this.timesValid == -1 || this.timesValid > this.views)
    );
  }

  isActive() {
    return this.active;
  }

  activate() {
    this.active = true;
  }

  deactivate() {
    this.active = false;
  }

  decryptMnemonic(code) {
    return aes.decrypt(this.mnemonic.toString(), code);
  }

  public isProtected(): boolean {
    return this.hashedPassword !== null;
  }

  toJSON() {
    return {
      id: this.id,
      token: this.token,
      mnemonic: this.mnemonic,
      bucket: this.bucket,
      isFolder: this.isFolder,
      views: this.views,
      timesValid: this.timesValid,
      active: this.active,
      code: this.code,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      fileId: this.fileId,
      fileSize: this.fileSize,
      folderId: this.folderId,
      fileToken: this.fileToken,
      item: this.item,
      encryptionKey: this.encryptionKey,
      hashedPassword: this.hashedPassword,
    };
  }
}
