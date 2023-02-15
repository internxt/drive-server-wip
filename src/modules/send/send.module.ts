import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { FileModule } from '../file/file.module';
import { FileModel } from '../file/file.repository';
import { FolderModule } from '../folder/folder.module';
import { FolderModel } from '../folder/folder.model';
import { UserModule } from '../user/user.module';
import { UserModel } from '../user/user.model';
import { SequelizeSendRepository } from './send-link.repository';
import { SendController } from './send.controller';
import { SendUseCases } from './send.usecase';
import { SendLinkModel } from './send-link.model';
import { SendLinkItemModel } from './send-link-item.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      SendLinkModel,
      SendLinkItemModel,
      UserModel,
      FileModel,
      FolderModel,
    ]),
    forwardRef(() => UserModule),
    FileModule,
    FolderModule,
    NotificationModule,
    CryptoModule,
  ],
  controllers: [SendController],
  providers: [SequelizeSendRepository, SendUseCases],
})
export class SendModule {}
