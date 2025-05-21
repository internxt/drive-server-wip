import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFolderRepository } from './folder.repository';
import { FolderModel } from './folder.model';
import { FolderUseCases } from './folder.usecase';
import { FileModule } from '../storage/file/file.module';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { FolderController } from './folder.controller';
import { UserModule } from '../user/user.module';
import { SharingModule } from '../sharing/sharing.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';

@Module({
  imports: [
    SequelizeModule.forFeature([FolderModel]),
    forwardRef(() => FileModule),
    forwardRef(() => UserModule),
    CryptoModule,
    forwardRef(() => SharingModule),
    forwardRef(() => WorkspacesModule),
    NotificationModule,
  ],
  controllers: [FolderController],
  providers: [SequelizeFolderRepository, CryptoService, FolderUseCases],
  exports: [FolderUseCases, SequelizeFolderRepository],
})
export class FolderModule {}
