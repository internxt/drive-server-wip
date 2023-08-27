import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { FileModule } from '../file/file.module';
import { SequelizeFileRepository } from '../file/file.repository';
import { FolderModule } from '../folder/folder.module';
import { FOLDER_MODEL_TOKEN, FolderModel } from '../folder/folder.model';
import { SequelizeFolderRepository } from '../folder/folder.repository';
import { UserModule } from '../user/user.module';
import { SequelizeUserRepository } from '../user/user.repository';
import { USER_MODEL_TOKEN, UserModel } from '../user/user.model';
import { ShareController } from './share.controller';
import { SequelizeShareRepository, ShareModel } from './share.repository';
import { ShareUseCases } from './share.usecase';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';
import { ThumbnailModel } from '../thumbnail/thumbnail.model';
import { FileModel } from '../file/file.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      FolderModel,
      ShareModel,
      FileModel,
      UserModel,
      ThumbnailModel,
    ]),
    forwardRef(() => FolderModule),
    forwardRef(() => FileModule),
    forwardRef(() => UserModule),
    forwardRef(() => ThumbnailModule),
    NotificationModule,
    CryptoModule,
  ],
  controllers: [ShareController],
  providers: [
    {
      provide: FOLDER_MODEL_TOKEN,
      useValue: null,
    },
    {
      provide: USER_MODEL_TOKEN,
      useValue: null,
    },
    SequelizeShareRepository,
    SequelizeFileRepository,
    SequelizeFolderRepository,
    SequelizeUserRepository,
    ShareUseCases,
  ],
  exports: [ShareUseCases],
})
export class ShareModule {}
