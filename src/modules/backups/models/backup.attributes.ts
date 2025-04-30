export interface BackupAttributes {
  id?: number;
  userId: number;
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
}
