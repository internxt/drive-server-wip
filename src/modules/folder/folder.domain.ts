import { CryptoService } from '../../externals/crypto/crypto';
export interface FolderAttributes {
  id: number;
  parentId: number;
  parent?: any;
  name: string;
  bucket: string;
  userId: number;
  encryptVersion: string;
  deleted: boolean;
  deletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Folder implements FolderAttributes {
  id: number;
  parentId: number;
  _parent: Folder;
  name: string;
  bucket: string;
  userId: number;
  encryptVersion: string;
  deleted: boolean;
  deletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  constructor({
    id,
    parentId,
    parent,
    name,
    bucket,
    userId,
    encryptVersion,
    deleted,
    deletedAt,
    createdAt,
    updatedAt,
  }: FolderAttributes) {
    this.id = id;
    this.parentId = parentId;
    this.parent = parent;
    this.name = this.decryptName(name);
    this.bucket = bucket;
    this.userId = userId;
    this.encryptVersion = encryptVersion;
    this.deleted = deleted;
    this.deletedAt = deletedAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(file: FolderAttributes): Folder {
    return new Folder(file);
  }
  decryptName(nameEncrypted) {
    const cryptoService = CryptoService.getInstance();
    return cryptoService.decryptName(nameEncrypted, this.parentId);
  }

  set parent(parent) {
    if (parent && !(parent instanceof Folder)) {
      throw Error('parent folder invalid');
    }
    this._parent = parent;
  }

  get parent() {
    return this._parent;
  }

  toJSON() {
    return {
      id: this.id,
      parentId: this.parentId,
      name: this.name,
      bucket: this.bucket,
      userId: this.userId,
      encryptVersion: this.encryptVersion,
      deleted: this.deleted,
      deletedAt: this.deletedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
