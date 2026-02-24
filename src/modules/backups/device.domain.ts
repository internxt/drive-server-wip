import { type DeviceAttributes } from './models/device.attributes';

// This is the UUID used for devices that are not linked to any folder.
export const DEVICE_LEGACY_NULL_FOLDER_UUID =
  '00000000-0000-0000-0000-000000000000';

export enum DevicePlatform {
  WINDOWS = 'win32',
  MACOS = 'darwin',
  LINUX = 'linux',
  ANDROID = 'android',
}

export class Device implements DeviceAttributes {
  id: number;
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

  constructor(attributes: DeviceAttributes) {
    this.id = attributes.id;
    this.mac = attributes.mac;
    this.userId = attributes.userId;
    this.name = attributes.name;
    this.platform = attributes.platform;
    this.key = attributes.key;
    this.hostname = attributes.hostname;
    this.folderUuid = attributes.folderUuid;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
    this.backups = attributes.backups;
  }

  static build(attributes: Partial<DeviceAttributes>): Device {
    return new Device(attributes as DeviceAttributes);
  }

  toJson(): DeviceAttributes {
    return {
      id: this.id,
      mac: this.mac,
      userId: this.userId,
      name: this.name,
      platform: this.platform,
      key: this.key,
      hostname: this.hostname,
      folderUuid: this.folderUuid,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
