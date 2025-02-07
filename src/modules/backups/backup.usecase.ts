import { Injectable } from '@nestjs/common';
import { SequelizeBackupRepository } from './backup.repository';

@Injectable()
export class BackupUseCase {
  constructor(private readonly backupRepository: SequelizeBackupRepository) {}

  async deleteUserBackups(userId: number) {
    const [deletedBackups, deletedDevices] = await Promise.all([
      this.backupRepository.deleteBackupsBy({ userId }),
      this.backupRepository.deleteDevicesBy({ userId }),
    ]);

    return { deletedBackups, deletedDevices };
  }
}
