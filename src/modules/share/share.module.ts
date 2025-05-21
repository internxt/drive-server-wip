import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { FileModule } from '../storage/file/file.module';
import { SequelizeFileRepository } from '../storage/file/file.repository';
import { FolderModule } from '../storage/folder/folder.module';
import { FolderModel } from '../storage/folder/folder.model';
import { SequelizeFolderRepository } from '../storage/folder/folder.repository';
import { UserModule } from '../user/user.module';
import { SequelizeUserRepository } from '../user/user.repository';
import { UserModel } from '../user/user.model';
import { ShareController } from './share.controller';
import { SequelizeShareRepository, ShareModel } from './share.repository';
import { ShareUseCases } from './share.usecase';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';
import { ThumbnailModel } from '../thumbnail/thumbnail.model';
import { FileModel } from '../storage/file/file.model';
import { UserNotificationTokensModel } from '../user/user-notification-tokens.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      ShareModel,
      FileModel,
      FolderModel,
      UserModel,
      ThumbnailModel,
      UserNotificationTokensModel,
    ]),
    forwardRef(() => FileModule),
    forwardRef(() => FolderModule),
    forwardRef(() => UserModule),
    forwardRef(() => ThumbnailModule),
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
