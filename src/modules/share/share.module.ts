import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { FileModule } from '../file/file.module';
import { SequelizeFileRepository } from '../file/file.repository';
import { FolderModule } from '../folder/folder.module';
import { FolderModel } from '../folder/folder.model';
import { SequelizeFolderRepository } from '../folder/folder.repository';
import { UserModule } from '../user/user.module';
import { SequelizeUserRepository } from '../user/user.repository';
import { UserModel } from '../user/user.model';
import { ShareController } from './share.controller';
import { SequelizeShareRepository, ShareModel } from './share.repository';
import { ShareUseCases } from './share.usecase';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';
import { ThumbnailModel } from '../thumbnail/thumbnail.model';
import { FileModel } from '../file/file.model';
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
