import { aes } from '@internxt/lib';
import { File } from '../file/file.domain';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';

export interface ShareAttributes {
  id: number;
  token: string;
  mnemonic: string;
  user: any;
  item: any;
  encryptionKey: string;
  bucket: string;
  itemToken: string;
  isFolder: boolean;
  views: number;
  timesValid: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  hashedPassword?: string;
}

export class Share implements ShareAttributes {
  id: number;
  token: string;
  mnemonic: string;
  user: User;
  item: File | Folder;
  encryptionKey: string;
  bucket: string;
  itemToken: string;
  isFolder: boolean;
  views: number;
  timesValid: number;
  active: boolean;
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

  setUser(user) {
    if (user && !(user instanceof User)) {
      throw Error('user invalid');
    }
    this.user = user;
  }

  incrementView() {
    this.views += 1;
  }

  canHaveView() {
    return (
      this.active && (this.timesValid === null || this.timesValid > this.views)
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

  isOwner(userId) {
    return this.user.id === userId;
  }

  decryptMnemonic(code) {
    this.mnemonic = aes.decrypt(this.mnemonic.toString(), code);
    return this.mnemonic;
  }

  public isProtected(): boolean {
    return this.hashedPassword !== null;
  }

  toJSON() {
    return {
      id: this.id,
      token: this.token,
      mnemonic: this.mnemonic,
      user: this.user ? this.user.toJSON() : null,
      item: this.item ? this.item.toJSON() : null,
      encryptionKey: this.encryptionKey,
      bucket: this.bucket,
      itemToken: this.itemToken,
      isFolder: this.isFolder,
      views: this.views,
      timesValid: this.timesValid,
      active: this.active,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      hashedPassword: this.hashedPassword,
    };
  }
}
