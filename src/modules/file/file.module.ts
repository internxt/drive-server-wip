import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFileRepository } from './file.repository';
import { FileUseCases } from './file.usecase';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { FileController } from './file.controller';
import { FolderModule } from '../folder/folder.module';
import { ThumbnailModel } from '../thumbnail/thumbnail.model';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';
import { FileModel } from './file.model';
import { SharingModule } from '../sharing/sharing.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [
    SequelizeModule.forFeature([FileModel, ThumbnailModel]),
    forwardRef(() => FolderModule),
    forwardRef(() => ThumbnailModule),
    forwardRef(() => SharingModule),
    forwardRef(() => WorkspacesModule),
    BridgeModule,
    CryptoModule,
    UserModule,
    NotificationModule,
    UsageModule,
  ],
  controllers: [FileController],
  providers: [SequelizeFileRepository, FileUseCases],
  exports: [FileUseCases, SequelizeModule, SequelizeFileRepository],
})
export class FileModule {}
