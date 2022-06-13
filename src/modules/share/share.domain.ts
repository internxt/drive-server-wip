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

  deactivate() {
    this.active = false;
  }

  isOwner(userId) {
    return this.user.id === userId;
  }

  toJSON() {
    console.log(this.item);
    return {
      id: this.id,
      token: this.token,
      mnemonic: this.mnemonic,
      user: this.user.toJSON(),
      item: this.item.toJSON(),
      encryptionKey: this.encryptionKey,
      bucket: this.bucket,
      itemToken: this.itemToken,
      isFolder: this.isFolder,
      views: this.views,
      timesValid: this.timesValid,
      active: this.active,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
