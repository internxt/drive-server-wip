import { File } from '../file/file.domain';

export interface ShareAttributes {
  id: number;
  token: string;
  mnemonic: string;
  user: number;
  fileId: string;
  file: any;
  encryptionKey: string;
  bucket: string;
  fileToken: string;
  isFolder: boolean;
  views: number;
}

export class Share implements ShareAttributes {
  id: number;
  token: string;
  mnemonic: string;
  user: number;
  fileId: string;
  file: File;
  encryptionKey: string;
  bucket: string;
  fileToken: string;
  isFolder: boolean;
  views: number;
  constructor({
    id,
    token,
    mnemonic,
    user,
    fileId,
    file,
    encryptionKey,
    bucket,
    fileToken,
    isFolder,
    views,
  }) {
    this.id = id;
    this.token = token;
    this.mnemonic = mnemonic;
    this.user = user;
    this.file = fileId;
    this.setFile(file);
    this.encryptionKey = encryptionKey;
    this.bucket = bucket;
    this.fileToken = fileToken;
    this.isFolder = isFolder;
    this.views = views;
  }

  static build(share: ShareAttributes): Share {
    return new Share(share);
  }
  setFile(file) {
    if (file && !(file instanceof File)) {
      throw Error('file invalid');
    }
    this.file = file;
  }

  toJSON() {
    return {
      id: this.id,
      token: this.token,
      mnemonic: this.mnemonic,
      user: this.user,
      file: this.file,
      encryptionKey: this.encryptionKey,
      bucket: this.bucket,
      fileToken: this.fileToken,
      isFolder: this.isFolder,
      views: this.views,
    };
  }
}
