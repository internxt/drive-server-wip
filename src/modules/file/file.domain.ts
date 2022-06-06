export class File {
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
  }) {
    this.id = id;
    this.fileId = fileId;
    this.name = name;
    this.type = type;
    this.size = size;
    this.bucket = bucket;
    this.folderId = folderId;
    this.encryptVersion = encryptVersion;
    this.deleted = deleted;
    this.deletedAt = deletedAt;
    this.userId = userId;
    this.modificationTime = modificationTime;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build({
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
  }) {
    return new File({
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
    });
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
