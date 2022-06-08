import { CryptoService } from 'src/externals/crypto/crypto';

export interface FileAttributes {
  id: number;
  fileId: string;
  name: string;
  type: string;
  size: bigint;
  bucket: string;
  folderId: number;
  encryptVersion: string;
  deleted: boolean;
  deletedAt: Date;
  userId: number;
  modificationTime: Date;
  createdAt: Date;
  updatedAt: Date;
}
export class File implements FileAttributes {
  id: number;
  fileId: string;
  name: string;
  type: string;
  size: bigint;
  bucket: string;
  folderId: number;
  encryptVersion: string;
  deleted: boolean;
  deletedAt: Date;
  userId: number;
  modificationTime: Date;
  createdAt: Date;
  updatedAt: Date;
  constructor({
    id,
    fileId,
    name,
    type,
    size,
    bucket,
    folderId,
    encryptVersion,
    deleted,
    deletedAt,
    userId,
    modificationTime,
    createdAt,
    updatedAt,
  }: FileAttributes) {
    this.id = id;
    this.fileId = fileId;
    this.folderId = folderId;
    this.name = this.decryptName(name);
    this.type = type;
    this.size = size;
    this.bucket = bucket;
    this.encryptVersion = encryptVersion;
    this.deleted = deleted;
    this.deletedAt = deletedAt;
    this.userId = userId;
    this.modificationTime = modificationTime;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(file: FileAttributes): File {
    return new File(file);
  }
  decryptName(name) {
    const cryptoService = new CryptoService();
    return cryptoService.decryptName(name, this.folderId);
  }

  toJSON() {
    return {
      id: this.id,
      fileId: this.fileId,
      name: this.name,
      type: this.type,
      size: this.size,
      bucket: this.bucket,
      folderId: this.folderId,
      encryptVersion: this.encryptVersion,
      deleted: this.deleted,
      deletedAt: this.deletedAt,
      userId: this.userId,
      modificationTime: this.modificationTime,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
