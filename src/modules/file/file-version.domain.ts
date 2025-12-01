export enum FileVersionStatus {
  EXISTS = 'EXISTS',
  DELETED = 'DELETED',
}

export interface FileVersionAttributes {
  id: string;
  fileId: string;
  userId: number;
  networkFileId: string;
  size: bigint;
  status: FileVersionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class FileVersion implements FileVersionAttributes {
  id: string;
  fileId: string;
  userId: number;
  networkFileId: string;
  size: bigint;
  status: FileVersionStatus;
  createdAt: Date;
  updatedAt: Date;

  private constructor(attributes: FileVersionAttributes) {
    this.id = attributes.id;
    this.fileId = attributes.fileId;
    this.userId = attributes.userId;
    this.networkFileId = attributes.networkFileId;
    this.size = attributes.size;
    this.status = attributes.status;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
  }

  static build(attributes: FileVersionAttributes): FileVersion {
    return new FileVersion(attributes);
  }

  isDeleted(): boolean {
    return this.status === FileVersionStatus.DELETED;
  }

  markAsDeleted(): void {
    this.status = FileVersionStatus.DELETED;
  }

  toJSON(): FileVersionAttributes {
    return {
      id: this.id,
      fileId: this.fileId,
      userId: this.userId,
      networkFileId: this.networkFileId,
      size: this.size,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
