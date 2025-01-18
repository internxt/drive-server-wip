import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BackupModel } from './models/backup.model';
import { DeviceModel } from './models/device.model';
import { SequelizeBackupRepository } from './backup.repository';
import { BackupUseCase } from './backup.usecase';

@Module({
  imports: [SequelizeModule.forFeature([BackupModel, DeviceModel])],
  providers: [SequelizeBackupRepository, BackupUseCase],
  exports: [SequelizeModule, BackupUseCase],
})
export class BackupModule {}
