import { type DevicePlatform } from '../device.domain';

export interface DeviceAttributes {
  id?: number;
  mac?: string;
  key?: string;
  hostname?: string;
  folderUuid?: string;
  userId: number;
  name?: string;
  platform?: DevicePlatform;
  createdAt?: Date;
  updatedAt?: Date;
  backups?: any[];
}
