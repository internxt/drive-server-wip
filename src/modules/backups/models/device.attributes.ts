export interface DeviceAttributes {
  id?: number;
  mac?: string;
  key?: string;
  hostname?: string;
  folderUuid?: string;
  userId: number;
  name?: string;
  platform?: string;
  createdAt?: Date;
  updatedAt?: Date;
  backups?: any[];
}
