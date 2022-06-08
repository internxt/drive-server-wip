export interface ShareAttributes {
  id: number;
  token: string;
  mnemonic: string;
  user: number;
  file: string;
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
  file: string;
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
    this.file = file;
    this.encryptionKey = encryptionKey;
    this.bucket = bucket;
    this.fileToken = fileToken;
    this.isFolder = isFolder;
    this.views = views;
  }

  static build(share: ShareAttributes): Share {
    return new Share(share);
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
