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
import { BackupModel } from './models/backup.model';
import { CreateDeviceDto } from './dto/create-device.dto';
import { SequelizeUserRepository } from '../user/user.repository';

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

  async createDevice(user: User, mac: string, payload: CreateDeviceDto) {
    const { platform, deviceName } = payload;
    const exists = await this.backupRepository.findDeviceByUserAndMac(
      user,
      mac,
    );
    if (exists) {
      return exists;
    }

    return this.backupRepository.createDevice(user, {
      mac,
      name: deviceName,
      platform,
    });
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

    return this.folderUsecases.createFolderDevice(user, {
      name: encryptedName,
      plainName: deviceName,
      bucket,
    });
  }

  async getDevicesAsFolder(user: User) {
    const { backupsBucket } = user;
    if (!backupsBucket) {
      throw new BadRequestException('Backups is not activated for this user');
    }

    const folders = await this.folderUsecases.getFoldersByUserId(user.id, {
      bucket: backupsBucket,
    });

    return Promise.all(
      folders.map(async (folder) => ({
        ...folder,
        plainName: this.cryptoService.decryptName(folder.name, folder.bucket),
        hasBackups: !(await this.isFolderEmpty(user, folder)),
        lastBackupAt: folder.updatedAt,
      })),
    );
  }

  async getDeviceAsFolder(user: User, folderId: FolderAttributes['id']) {
    const folder = await this.folderUsecases.getFolderByUserId(
      folderId,
      user.id,
    );
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return {
      ...folder,
      hasBackups: !(await this.isFolderEmpty(user, folder)),
      lastBackupAt: folder.updatedAt,
    };
  }

  async updateDeviceAsFolder(
    user: User,
    folderId: FolderAttributes['id'],
    deviceName: string,
  ) {
    const folder = await this.folderUsecases.getFolderByUserId(
      folderId,
      user.id,
    );
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    const encryptedName = this.cryptoService.encryptName(
      deviceName,
      folder.bucket,
    );

    return this.folderUsecases.updateByFolderId(folder, {
      name: encryptedName,
      plainName: deviceName,
    });
  }

  async createBackup(user: User, payload: Partial<BackupModel>) {
    const { deviceId } = payload;
    const device = await this.backupRepository.findDeviceByUserAndId(
      user,
      deviceId,
    );
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return this.backupRepository.createBackup(user, payload);
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
}
