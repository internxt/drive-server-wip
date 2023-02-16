import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { FileModule } from '../file/file.module';
import { FileModel } from '../file/file.repository';
import { FolderModule } from '../folder/folder.module';
import { FolderModel } from '../folder/folder.repository';
import { UserModule } from '../user/user.module';
import { UserModel } from '../user/user.model';
import {
  SendLinkItemModel,
  SendLinkModel,
  SequelizeSendRepository,
} from './send-link.repository';
import { SendController } from './send.controller';
import { SendUseCases } from './send.usecase';

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
