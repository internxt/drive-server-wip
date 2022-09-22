import { aes } from '@internxt/lib';

import { File, FileAttributes } from '../file/file.domain';
import { Folder, FolderAttributes } from '../folder/folder.domain';
import { UserAttributes } from '../user/user.domain';
import { ShareDto } from './dto/share.dto';

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
  hashedPassword: string | null;
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
  /**
   * Only if the item is a file
   */
  encryptionKey?: string;

  constructor(attributes: ShareAttributes) {
    this.id = attributes.id;
    this.token = attributes.token;
    this.mnemonic = attributes.mnemonic;
    this.bucket = attributes.bucket;
    this.isFolder = attributes.isFolder;
    this.views = attributes.views;
    this.timesValid = attributes.timesValid;
    this.active = attributes.active;
    this.code = attributes.code;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
    this.fileId = attributes.fileId;
    this.fileSize = attributes.fileSize;
    this.folderId = attributes.folderId;
    this.fileToken = attributes.fileToken;
    this.userId = attributes.userId;
    this.hashedPassword = attributes.hashedPassword;
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

  toJSON(): ShareDto {
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
      protected: this.isProtected(),
    };
  }
}
