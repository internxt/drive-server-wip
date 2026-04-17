import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SequelizeBackupRepository } from './backup.repository';
import { type User } from '../user/user.domain';
import { BridgeService } from './../../externals/bridge/bridge.service';
import { CryptoService } from './../../externals/crypto/crypto.service';
import { FolderUseCases } from '../folder/folder.usecase';
import { Folder, type FolderAttributes } from '../folder/folder.domain';
import { SequelizeUserRepository } from '../user/user.repository';
import { type BackupModel } from './models/backup.model';
import { type DeviceAttributes } from './models/device.attributes';
import { type CreateDeviceAndFolderDto } from './dto/create-device-and-folder.dto';
import { type CreateDeviceAndAttachFolderDto } from './dto/create-device-and-attach-folder.dto';
import { type DevicePlatform } from './device.domain';
import { type UpdateDeviceAndFolderDto } from './dto/update-device-and-folder.dto';
import { SequelizeFolderRepository } from '../folder/folder.repository';
import { SequelizeFileRepository } from '../file/file.repository';
import { FileStatus } from '../file/file.domain';

@Injectable()
export class BackupUseCase {
  constructor(
    private readonly backupRepository: SequelizeBackupRepository,
    private readonly networkService: BridgeService,
    private readonly userRepository: SequelizeUserRepository,
    private readonly cryptoService: CryptoService,
    @Inject(forwardRef(() => FolderUseCases))
    private readonly folderUsecases: FolderUseCases,
    private readonly folderRepository: SequelizeFolderRepository,
    private readonly fileRepository: SequelizeFileRepository,
  ) {}

  async deleteUserBackups(userId: number) {
    const [deletedBackups, deletedDevices] = await Promise.all([
      this.backupRepository.deleteBackupsBy({ userId }),
      this.backupRepository.deleteDevicesBy({ userId }),
    ]);

    return { deletedBackups, deletedDevices };
  }

  async getAllLegacyDevices(user: User) {
    return this.backupRepository.findAllLegacyDevices(user);
  }

  // @deprecated
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

    // We do not have an index to cover this query, but it is not a frequent operation
    const folder = await this.folderRepository.findOne({
      bucket,
      plainName: deviceName,
      deleted: false,
      removed: false,
      userId: user.id,
    });

    if (folder) {
      throw new ConflictException('Folder with the same name already exists');
    }

    const createdFolder = await this.folderRepository.createFolder(user.id, {
      plainName: deviceName,
      bucket,
    });

    return this.addFolderAsDeviceProperties(user, createdFolder);
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
    await this.backupRepository.deleteDevicesBy({
      userId: user.id,
      folderUuid: uuid,
    });
  }

  async getDevicesAsFolder(user: User) {
    this.verifyUserHasBackupsEnabled(user);

    const folders = await this.folderUsecases.getFoldersByUserId(user.id, {
      bucket: user.backupsBucket,
      removed: false,
      deleted: false,
    });

    return Promise.all(
      folders.map(async (folder) => {
        const decryptedFolder = this.decryptBackupFolderName(folder);

        return {
          ...(await this.addFolderAsDeviceProperties(user, decryptedFolder)),
          plainName: decryptedFolder.plainName,
          plain_name: decryptedFolder.plainName, //TODO: temporary hotfix remove after mac newer version is released
        };
      }),
    );
  }

  async getDeviceAsFolder(user: User, uuid: FolderAttributes['uuid']) {
    const folder = await this.folderUsecases.getFolderByUuid(uuid, user);
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return this.addFolderAsDeviceProperties(
      user,
      this.decryptBackupFolderName(folder),
    );
  }

  async getDeviceAsFolderById(user: User, id: FolderAttributes['id']) {
    const folder = await this.folderUsecases.getFolderByUserId(id, user.id);
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return this.addFolderAsDeviceProperties(
      user,
      this.decryptBackupFolderName(folder),
    );
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

    const updatedFolder =
      await this.folderUsecases.updateByFolderIdAndForceUpdatedAt(folder, {
        plainName: deviceName,
      });

    return this.addFolderAsDeviceProperties(user, updatedFolder);
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

    const folderUuids = [
      ...new Set(devices.map((d) => d.folderUuid).filter(Boolean)),
    ];

    if (folderUuids.length === 0) {
      return devices.map((device) => ({ ...device, folder: null }));
    }

    const folders = await this.folderRepository.findByUuids(
      folderUuids,
      user.id,
    );

    const foldersWithProperties = await Promise.all(
      folders.map((folder) =>
        this.addFolderAsDeviceProperties(
          user,
          this.decryptBackupFolderName(folder),
        ),
      ),
    );

    const folderMap = new Map(
      foldersWithProperties.map((folder) => [folder.uuid, folder]),
    );

    return devices.map((device) => ({
      ...device,
      folder: device.folderUuid ? folderMap.get(device.folderUuid) : null,
    }));
  }

  async createDeviceAndFolder(
    user: User,
    createDeviceDto: CreateDeviceAndFolderDto,
  ) {
    if (!createDeviceDto.key && !createDeviceDto.hostname) {
      throw new BadRequestException('You need to send either hostname or key');
    }

    await this.verifyDeviceDoesNotExist(user, {
      key: createDeviceDto.key,
      platform: createDeviceDto.platform,
      hostname: createDeviceDto.hostname,
      name: createDeviceDto.name,
    });

    const folder = await this.createDeviceAsFolder(user, createDeviceDto.name);

    const deviceData: Omit<DeviceAttributes, 'id'> = {
      ...createDeviceDto,
      folderUuid: folder.uuid,
      userId: user.id,
    };

    const device = await this.backupRepository.createDevice(deviceData);

    return { ...device, folder };
  }

  async deleteDeviceAndFolderByKey(user: User, deviceKey: string) {
    const device = await this.backupRepository.findDeviceByUserAndKey(
      user,
      deviceKey,
    );

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (device.folderUuid) {
      const folder = await this.folderUsecases.getFolderByUuid(
        device.folderUuid,
        user,
      );
      if (folder.bucket === user.backupsBucket) {
        await this.folderUsecases.deleteByUser(user, [folder]);
      }
    }

    await this.backupRepository.deleteDevicesBy({
      id: device.id,
      userId: user.id,
    });
  }

  async updateDeviceAndFolderNameByKey(
    user: User,
    deviceKey: string,
    updateDeviceDto: UpdateDeviceAndFolderDto,
  ) {
    const device = await this.backupRepository.findDeviceByUserAndKey(
      user,
      deviceKey,
    );

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const existingDevice = await this.backupRepository.findOneUserDeviceByName(
      user,
      updateDeviceDto.name,
    );

    if (existingDevice) {
      throw new ConflictException(
        'A device with this name already exists for this user',
      );
    }

    const foldersWithSameName = await this.folderUsecases.getFoldersByUserId(
      user.id,
      {
        bucket: user.backupsBucket,
        plainName: updateDeviceDto.name,
        deleted: false,
        removed: false,
      },
    );

    if (foldersWithSameName.length > 0) {
      throw new ConflictException(
        'A folder as device with this name already exists in the backups bucket',
      );
    }

    const folder = await this.folderUsecases.getByUuid(device.folderUuid);

    let updatedFolder: Folder;

    if (folder) {
      updatedFolder = await this.folderRepository.updateOneAndReturn(
        {
          plainName: updateDeviceDto.name,
        },
        { userId: user.id, uuid: folder.uuid },
      );
    }

    const updatedDevice = await this.backupRepository.updateDeviceName(
      user,
      device.id,
      updateDeviceDto.name,
    );

    return {
      ...updatedDevice,
      folder: updatedFolder
        ? await this.addFolderAsDeviceProperties(user, updatedFolder)
        : undefined,
    };
  }

  async createDeviceForExistingFolder(
    user: User,
    createDeviceDto: CreateDeviceAndAttachFolderDto,
  ) {
    if (!createDeviceDto.key && !createDeviceDto.hostname) {
      throw new BadRequestException('You need to send either hostname or key');
    }

    this.verifyUserHasBackupsEnabled(user);

    await this.verifyDeviceDoesNotExist(user, {
      key: createDeviceDto.key,
      platform: createDeviceDto.platform,
      hostname: createDeviceDto.hostname,
      name: createDeviceDto.name,
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

    return {
      ...device,
      folder: await this.addFolderAsDeviceProperties(
        user,
        this.decryptBackupFolderName(folder),
      ),
    };
  }

  private verifyUserHasBackupsEnabled(user: User) {
    if (!user.hasBackupsEnabled()) {
      throw new BadRequestException('Backups is not enabled for this user');
    }
  }

  private async verifyDeviceDoesNotExist(
    user: User,
    device: {
      key?: string;
      hostname?: string;
      platform: DevicePlatform;
      name?: string;
    },
  ) {
    const existentDevice =
      await this.backupRepository.findConflictingUserDevice(user, device);

    if (existentDevice) {
      const fieldsToCheck = ['key', 'hostname', 'name'] as const;

      const conflictFields = fieldsToCheck.filter(
        (field) => device[field] && existentDevice[field] === device[field],
      );

      const fieldsList = conflictFields.join(', ');

      throw new ConflictException(
        `There is already a device with the same ${fieldsList} on this platform`,
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
    const folderInFolder = await this.folderRepository.findOne({
      parentUuid: folder.uuid,
      userId: user.id,
      removed: false,
      deleted: false,
    });
    const fileInFolder = await this.fileRepository.findOneBy({
      folderUuid: folder.uuid,
      userId: user.id,
      status: FileStatus.EXISTS,
    });

    return !folderInFolder && !fileInFolder;
  }

  async sumExistentBackupSizes(userId: number) {
    return this.backupRepository.sumExistentBackupSizes(userId);
  }

  private decryptBackupFolderName(folder: Folder): Folder {
    if (folder.plainName) {
      return folder;
    }

    try {
      const decryptedName = this.cryptoService.decryptName(
        folder.name,
        folder.bucket,
      );

      if (decryptedName === '') {
        return Folder.build({ ...folder, plainName: folder.name });
      }

      return Folder.build({ ...folder, plainName: decryptedName });
    } catch {
      return Folder.build({ ...folder, plainName: folder.name });
    }
  }

  private async addFolderAsDeviceProperties(user: User, folder: Folder) {
    const isEmpty = await this.isFolderEmpty(user, folder);
    return {
      ...folder,
      hasBackups: !isEmpty,
      lastBackupAt: folder.updatedAt,
      status: folder.getFolderStatus(),
    };
  }
}
