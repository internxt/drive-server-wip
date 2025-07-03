import { DeviceAttributes } from './models/device.attributes';

export class Device implements DeviceAttributes {
  id?: number;
  mac?: string;
  key?: string;
  folderUuid?: string;
  userId: number;
  name: string;
  platform?: string;
  createdAt: Date;
  updatedAt: Date;
  backups?: any[];

  constructor(attributes: DeviceAttributes) {
    this.id = attributes.id;
    this.mac = attributes.mac;
    this.userId = attributes.userId;
    this.name = attributes.name;
    this.platform = attributes.platform;
    this.key = attributes.key;
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
      folderUuid: this.folderUuid,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
