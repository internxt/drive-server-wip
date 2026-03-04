import { type BackupAttributes } from './models/backup.attributes';

export class Backup implements BackupAttributes {
  id?: number;
  userId: number;
  planId?: string;
  uuid?: string;
  path?: string;
  fileId?: string;
  deviceId: number;
  hash?: string;
  interval?: number;
  size?: number;
  bucket?: string;
  lastBackupAt?: Date;
  enabled?: boolean;
  encrypt_version?: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(attributes: BackupAttributes) {
    this.id = attributes.id;
    this.userId = attributes.userId;
    this.path = attributes.path;
    this.fileId = attributes.fileId;
    this.deviceId = attributes.deviceId;
    this.hash = attributes.hash;
    this.interval = attributes.interval;
    this.size = attributes.size;
    this.bucket = attributes.bucket;
    this.lastBackupAt = attributes.lastBackupAt;
    this.enabled = attributes.enabled;
    this.encrypt_version = attributes.encrypt_version;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
  }

  static build(attributes: Partial<BackupAttributes>): Backup {
    return new Backup(attributes as BackupAttributes);
  }

  toJson(): BackupAttributes {
    return {
      id: this.id,
      userId: this.userId,
      path: this.path,
      fileId: this.fileId,
      deviceId: this.deviceId,
      hash: this.hash,
      interval: this.interval,
      size: this.size,
      bucket: this.bucket,
      lastBackupAt: this.lastBackupAt,
      enabled: this.enabled,
      encrypt_version: this.encrypt_version,
    };
  }
}
