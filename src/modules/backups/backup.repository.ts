import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DeviceModel } from './models/device.model';
import { BackupModel } from './models/backup.model';

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
}
