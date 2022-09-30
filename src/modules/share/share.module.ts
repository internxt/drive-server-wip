import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { FileModule } from '../file/file.module';
import { FileModel, SequelizeFileRepository } from '../file/file.repository';
import { FolderModule } from '../folder/folder.module';
import {
  FolderModel,
  SequelizeFolderRepository,
} from '../folder/folder.repository';
import { UserModule } from '../user/user.module';
import { SequelizeUserRepository, UserModel } from '../user/user.repository';
import { ShareController } from './share.controller';
import { SequelizeShareRepository, ShareModel } from './share.repository';
import { ShareUseCases } from './share.usecase';

@Module({
  imports: [
    SequelizeModule.forFeature([ShareModel, FileModel, FolderModel, UserModel]),
    forwardRef(() => FileModule),
    forwardRef(() => FolderModule),
    UserModule,
    NotificationModule,
    CryptoModule,
  ],
  controllers: [ShareController],
  providers: [
    SequelizeShareRepository,
    SequelizeFileRepository,
    SequelizeFolderRepository,
    SequelizeUserRepository,
    ShareUseCases,
  ],
  exports: [ShareUseCases],
})
export class ShareModule {}
