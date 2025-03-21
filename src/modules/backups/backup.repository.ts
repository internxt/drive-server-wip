import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DeviceModel } from './models/device.model';
import { BackupModel } from './models/backup.model';
import { Device } from './device.domain';
import { Backup } from './backup.domain';
import { User } from '../user/user.domain';
import { Sequelize } from 'sequelize';

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

  async findDeviceByUserAndMac(user: User, mac: string) {
    const device = await this.deviceModel.findOne({
      where: { userId: user.id, mac },
    });
    return device ? this.toDomainDevice(device) : null;
  }

  async findAllDevices(user: User) {
    const devices = await this.deviceModel.findAll({
      where: { userId: user.id },
      attributes: {
        include: [[Sequelize.fn('SUM', Sequelize.col('backups.size')), 'size']],
      },
      group: [Sequelize.col('DeviceModel.id'), Sequelize.col('backups.id')],
      include: [
        {
          model: BackupModel,
          as: 'backups',
        },
      ],
    });
    return devices.map(this.toDomainDevice);
  }

  async findDeviceByUserAndId(user: User, deviceId: number) {
    const device = await this.deviceModel.findOne({
      where: { userId: user.id, id: deviceId },
      include: [
        {
          model: BackupModel,
          as: 'backups',
          required: false,
        },
      ],
    });
    return device ? this.toDomainDevice(device) : null;
  }

  async findAllBackupsByUserAndDevice(user: User, deviceId: number) {
    const backups = await this.backupModel.findAll({
      where: { userId: user.id, deviceId },
    });
    return backups.map(this.toDomainBackup);
  }

  async findBackupByUserAndId(user: User, backupId: number) {
    const backup = await this.backupModel.findOne({
      where: { userId: user.id, id: backupId },
    });
    return backup ? this.toDomainBackup(backup) : null;
  }

  async deleteBackupByUserAndId(user: User, backupId: number) {
    return this.backupModel.destroy({
      where: { userId: user.id, id: backupId },
    });
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
