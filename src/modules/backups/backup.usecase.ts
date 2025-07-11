import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SequelizeBackupRepository } from './backup.repository';
import { User } from '../user/user.domain';
import { BridgeService } from './../../externals/bridge/bridge.service';
import { CryptoService } from './../../externals/crypto/crypto.service';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileUseCases } from '../file/file.usecase';
import { Folder, FolderAttributes } from '../folder/folder.domain';
import { SequelizeUserRepository } from '../user/user.repository';
import { BackupModel } from './models/backup.model';
import { DeviceAttributes } from './models/device.attributes';
import { CreateDeviceAndFolderDto } from './dto/create-device-and-folder.dto';
import { CreateDeviceAndAttachFolderDto } from './dto/create-device-and-attach-folder.dto';
import { DevicePlatform } from './device.domain';

@Injectable()
export class BackupUseCase {
  constructor(
    private readonly backupRepository: SequelizeBackupRepository,
    private readonly networkService: BridgeService,
    private readonly userRepository: SequelizeUserRepository,
    private readonly cryptoService: CryptoService,
    @Inject(forwardRef(() => FolderUseCases))
    private readonly folderUsecases: FolderUseCases,
    @Inject(forwardRef(() => FileUseCases))
    private readonly fileUsecases: FileUseCases,
  ) {}

  async deleteUserBackups(userId: number) {
    const [deletedBackups, deletedDevices] = await Promise.all([
      this.backupRepository.deleteBackupsBy({ userId }),
      this.backupRepository.deleteDevicesBy({ userId }),
    ]);

    return { deletedBackups, deletedDevices };
  }

  async getAllDevices(user: User) {
    return this.backupRepository.findAllDevices(user);
  }

  async deleteDevice(user: User, deviceId: number) {
    const device = await this.backupRepository.findDeviceByUserAndId(
      user,
      deviceId,
    );
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    await Promise.all(
      device.backups.map((backup: BackupModel) => {
        if (backup.fileId) {
          return this.networkService.deleteFile(
            user,
            backup.bucket,
            backup.fileId,
          );
        }
      }),
    );

    await this.backupRepository.deleteBackupsBy({ deviceId });

    return this.backupRepository.deleteDevicesBy({
      userId: user.id,
      id: deviceId,
    });
  }

  async activate(user: User) {
    const { email, userId, backupsBucket } = user;
    if (backupsBucket) {
      return { backupsBucket };
    }
    const bucket = await this.networkService.createBucket(email, userId);
    await this.userRepository.updateByUuid(user.uuid, {
      backupsBucket: bucket.id,
    });
    return { backupsBucket: bucket.id };
  }

  async createDeviceAsFolder(user: User, deviceName: string) {
    let bucket = user.backupsBucket;
    if (!bucket) {
      const { backupsBucket } = await this.activate(user);
      bucket = backupsBucket;
    }

    const encryptedName = this.cryptoService.encryptName(deviceName, bucket);
    const folders = await this.folderUsecases.getFolders(user.id, {
      bucket,
      name: encryptedName,
      deleted: false,
      removed: false,
    });

    if (folders.length > 0) {
      throw new ConflictException('Folder with the same name already exists');
    }

    const createdFolder = await this.folderUsecases.createFolderDevice(user, {
      name: encryptedName,
      plainName: deviceName,
      bucket,
    });

    return this.addDeviceProperties(user, createdFolder);
  }

  async deleteDeviceAsFolder(user: User, uuid: FolderAttributes['uuid']) {
    const folder = await this.folderUsecases.getFolderByUuid(uuid, user);
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    const { backupsBucket } = user;

    if (folder.bucket !== backupsBucket) {
      throw new BadRequestException('Folder is not in the backups bucket');
    }

    await this.folderUsecases.deleteByUser(user, [folder]);
  }

  async getDevicesAsFolder(user: User) {
    this.verifyUserHasBackupsEnabled(user);

    const folders = await this.folderUsecases.getFoldersByUserId(user.id, {
      bucket: user.backupsBucket,
    });

    return Promise.all(
      folders.map(async (folder) => ({
        ...(await this.addDeviceProperties(user, folder)),
        plainName: this.cryptoService.decryptName(folder.name, folder.bucket),
      })),
    );
  }

  async getDeviceAsFolder(user: User, uuid: FolderAttributes['uuid']) {
    const folder = await this.folderUsecases.getFolderByUuid(uuid, user);
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return this.addDeviceProperties(user, folder);
  }

  async getDeviceAsFolderById(user: User, id: FolderAttributes['id']) {
    const folder = await this.folderUsecases.getFolderByUserId(id, user.id);
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return this.addDeviceProperties(user, folder);
  }

  async updateDeviceAsFolder(
    user: User,
    uuid: FolderAttributes['uuid'],
    deviceName: string,
  ) {
    const folder = await this.folderUsecases.getFolderByUuid(uuid, user);
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    const encryptedName = this.cryptoService.encryptName(
      deviceName,
      folder.bucket,
    );

    const updatedFolder =
      await this.folderUsecases.updateByFolderIdAndForceUpdatedAt(folder, {
        name: encryptedName,
        plainName: deviceName,
      });

    return this.addDeviceProperties(user, updatedFolder);
  }

  async getBackupsByMac(user: User, mac: string) {
    const device = await this.backupRepository.findDeviceByUserAndMac(
      user,
      mac,
    );
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return this.backupRepository.findAllBackupsByUserAndDevice(user, device.id);
  }

  async getUserDevices(
    user: User,
    filterOptions: Partial<
      Pick<DeviceAttributes, 'key' | 'platform' | 'hostname'>
    >,
    limit: number,
    offset: number,
  ) {
    this.verifyUserHasBackupsEnabled(user);

    const devices = await this.backupRepository.findUserDevicesBy(
      user,
      {
        ...filterOptions,
      },
      limit,
      offset,
    );

    return devices;
  }

  async createDeviceAndFolder(
    user: User,
    createDeviceDto: CreateDeviceAndFolderDto,
  ) {
    if (!user.hasBackupsEnabled()) {
      await this.activate(user);
    }

    await this.verifyDeviceDoesNotExist(user, {
      key: createDeviceDto.key,
      platform: createDeviceDto.platform,
      hostname: createDeviceDto.hostname,
    });

    const folder = await this.createDeviceAsFolder(user, createDeviceDto.name);

    const deviceData: Omit<DeviceAttributes, 'id'> = {
      ...createDeviceDto,
      folderUuid: folder.uuid,
      userId: user.id,
    };

    const device = await this.backupRepository.createDevice(deviceData);

    return { ...device.toJson(), folder };
  }

  async createDeviceForExistingFolder(
    user: User,
    createDeviceDto: CreateDeviceAndAttachFolderDto,
  ) {
    if (!user.hasBackupsEnabled()) {
      await this.activate(user);
    }

    await this.verifyDeviceDoesNotExist(user, {
      key: createDeviceDto.key,
      platform: createDeviceDto.platform,
      hostname: createDeviceDto.hostname,
    });

    const deviceAssignedToFolder =
      await this.backupRepository.findOneUserDeviceBy(user, {
        folderUuid: createDeviceDto.folderUuid,
      });

    if (deviceAssignedToFolder) {
      throw new ConflictException(
        `This folder is already assigned to the device ${deviceAssignedToFolder.name}`,
      );
    }

    const folder = await this.folderUsecases.getFolderByUuid(
      createDeviceDto.folderUuid,
      user,
    );

    if (folder?.bucket !== user.backupsBucket) {
      throw new BadRequestException(
        'Passed folder uuid does not belongs to a backups folder',
      );
    }

    const deviceData: Omit<DeviceAttributes, 'id'> = {
      ...createDeviceDto,
      folderUuid: createDeviceDto.folderUuid,
      userId: user.id,
    };

    const device = await this.backupRepository.createDevice(deviceData);

    return { ...device.toJson(), folder };
  }

  private verifyUserHasBackupsEnabled(user: User) {
    if (!user.hasBackupsEnabled()) {
      throw new BadRequestException('Backups is not enabled for this user');
    }
  }

  private async verifyDeviceDoesNotExist(
    user: User,
    device: { key?: string; hostname?: string; platform: DevicePlatform },
  ) {
    const existentDevice =
      await this.backupRepository.findOneUserDeviceByKeyOrHostname(
        user,
        device,
      );

    if (existentDevice) {
      throw new ConflictException(
        'There is already a device with the same key or hostname on this platform',
      );
    }
  }

  async deleteBackup(user: User, backupId: number) {
    const backup = await this.backupRepository.findBackupByUserAndId(
      user,
      backupId,
    );
    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    return this.backupRepository.deleteBackupByUserAndId(user, backupId);
  }

  async isFolderEmpty(user: User, folder: Folder) {
    const folders = await this.folderUsecases.getFoldersByParentId(
      folder.id,
      user.id,
    );
    const files = await this.fileUsecases.getByFolderAndUser(
      folder.id,
      user.id,
      { deleted: false },
    );
    return folders.length === 0 && files.length === 0;
  }

  async sumExistentBackupSizes(userId: number) {
    return this.backupRepository.sumExistentBackupSizes(userId);
  }

  private async addDeviceProperties(user: User, folder: Folder) {
    const isEmpty = await this.isFolderEmpty(user, folder);
    return {
      ...folder,
      hasBackups: !isEmpty,
      lastBackupAt: folder.updatedAt,
      status: folder.getFolderStatus(),
    };
  }
}
