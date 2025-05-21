import { NotificationModule } from './../../externals/notifications/notifications.module';
import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BackupController } from './backup.controller';
import { BackupUseCase } from './backup.usecase';
import { SequelizeBackupRepository } from './backup.repository';
import { BackupModel } from './models/backup.model';
import { DeviceModel } from './models/device.model';
import { UserModel } from '../user/user.model';
import { BridgeModule } from './../../externals/bridge/bridge.module';
import { CryptoModule } from './../../externals/crypto/crypto.module';
import { FileModule } from '../storage/file/file.module';
import { FolderModule } from '../folder/folder.module';
import { SequelizeUserRepository } from '../user/user.repository';
import { FolderModel } from '../folder/folder.model';
import { SharingModule } from '../sharing/sharing.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UserNotificationTokensModel } from '../user/user-notification-tokens.model';
import { ShareModel } from '../share/share.repository';
import { ShareModule } from '../share/share.module';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';
import { ThumbnailModel } from '../thumbnail/thumbnail.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      BackupModel,
      DeviceModel,
      FolderModel,
      UserModel,
      UserNotificationTokensModel,
      ShareModel,
      ThumbnailModel,
    ]),
    forwardRef(() => FileModule),
    forwardRef(() => FolderModule),
    forwardRef(() => ShareModule),
    forwardRef(() => ThumbnailModule),
    forwardRef(() => SharingModule),
    forwardRef(() => WorkspacesModule),
    CryptoModule,
    BridgeModule,
    NotificationModule,
  ],
  controllers: [BackupController],
  providers: [
    SequelizeBackupRepository,
    BackupUseCase,
    SequelizeUserRepository,
  ],
  exports: [BackupUseCase, SequelizeBackupRepository],
})
export class BackupModule {}
