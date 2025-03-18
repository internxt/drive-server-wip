import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DeviceModel } from './models/device.model';
import { BackupModel } from './models/backup.model';
import { Device } from './device.domain';
import { Backup } from './backup.domain';

@Injectable()
export class SequelizeBackupRepository {
  constructor(
    @InjectModel(DeviceModel)
    private readonly deviceModel: typeof DeviceModel,
    @InjectModel(BackupModel)
    private readonly backupModel: typeof BackupModel,
  ) {}

  public async deleteDevicesBy(where: Partial<DeviceModel>): Promise<number> {
    return this.deviceModel.destroy({ where });
  }

  public async deleteBackupsBy(where: Partial<BackupModel>): Promise<number> {
    return this.backupModel.destroy({ where });
  }

  private toDomainDevice(deviceModel: DeviceModel): Device {
    const backups =
      deviceModel.backups?.map((b) => Backup.build(b.toJSON())) || [];
    return Device.build({ ...deviceModel.toJSON(), backups });
  }

  private toDomainBackup(backupModel: BackupModel): Backup {
    return Backup.build(backupModel.toJSON());
  }
}
