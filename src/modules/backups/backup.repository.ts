import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DeviceModel } from './models/device.model';
import { BackupModel } from './models/backup.model';
import { Device, DEVICE_LEGACY_NULL_FOLDER_UUID } from './device.domain';
import { Backup } from './backup.domain';
import { type User } from '../user/user.domain';
import { Op, Sequelize } from 'sequelize';
import { type DeviceAttributes } from './models/device.attributes';

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

  public async createDevice(
    newDevice: Omit<DeviceAttributes, 'id'>,
  ): Promise<Device> {
    const device = await this.deviceModel.create(newDevice);
    return this.toDomainDevice(device);
  }

  public async deleteBackupsBy(where: Partial<BackupModel>): Promise<number> {
    return this.backupModel.destroy({ where });
  }

  async findUserDevicesBy(
    user: User,
    where: Omit<Partial<DeviceAttributes>, 'userId'>,
    limit: number,
    offset: number,
  ) {
    const folderUuidFilter = {
      folderUuid: where.folderUuid ?? {
        [Op.ne]: DEVICE_LEGACY_NULL_FOLDER_UUID,
      },
    };

    const devices = await this.deviceModel.findAll({
      where: {
        userId: user.id,
        ...where,
        ...folderUuidFilter,
      },
      limit,
      offset,
    });
    return devices.map((device) => this.toDomainDevice(device));
  }

  async findOneUserDeviceBy(
    user: User,
    where: Omit<Partial<DeviceAttributes>, 'userId'>,
  ) {
    const device = await this.deviceModel.findOne({
      where: { userId: user.id, ...where },
    });
    return device ? this.toDomainDevice(device) : null;
  }

  async findOneUserDeviceByName(user: User, name: string) {
    const device = await this.deviceModel.findOne({
      where: { userId: user.id, name },
    });
    return device ? this.toDomainDevice(device) : null;
  }

  async updateDeviceName(user: User, deviceId: number, newName: string) {
    const [_, affectedDevice] = await this.deviceModel.update(
      { name: newName },
      {
        where: { id: deviceId, userId: user.id },
        returning: true,
      },
    );

    return affectedDevice.length > 0
      ? this.toDomainDevice(affectedDevice[0])
      : null;
  }

  async findConflictingUserDevice(
    user: User,
    where: Pick<DeviceAttributes, 'key' | 'hostname' | 'platform' | 'name'>,
  ) {
    const { key, hostname, platform, name } = where;

    const device = await this.deviceModel.findOne({
      where: {
        userId: user.id,
        [Op.or]: [
          ...(key ? [{ key }] : []),
          ...(hostname ? [{ hostname }] : []),
          ...(name ? [{ name }] : []),
        ],
        ...(platform && { platform }),
      },
    });

    return device ? this.toDomainDevice(device) : null;
  }

  async findDeviceByUserAndMac(user: User, mac: string) {
    const device = await this.deviceModel.findOne({
      where: { userId: user.id, mac },
    });
    return device ? this.toDomainDevice(device) : null;
  }

  async findAllLegacyDevices(user: User) {
    const devices = await this.deviceModel.findAll({
      where: {
        userId: user.id,
        // Preventes fetching devices linked to a folder
        folderUuid: DEVICE_LEGACY_NULL_FOLDER_UUID,
      },
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

  async findDeviceByUserAndKey(user: User, key: string) {
    const device = await this.deviceModel.findOne({
      where: { userId: user.id, key },
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

  async sumExistentBackupSizes(userId: number) {
    const result = await this.backupModel.findAll({
      attributes: [[Sequelize.fn(`SUM`, Sequelize.col('size')), 'total']],
      where: { userId },
      raw: true,
    });

    return Number(result[0]['total']) as unknown as number;
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
