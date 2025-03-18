export interface DeviceAttributes {
  id?: number;
  mac: string;
  userId: number;
  name?: string;
  platform?: string;
  createdAt?: Date;
  updatedAt?: Date;
  backups?: any[];
}
