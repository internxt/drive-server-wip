import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { FileModule } from '../file/file.module';
import { FileModel } from '../file/file.repository';
import { FolderModule } from '../folder/folder.module';
import { FolderModel } from '../folder/folder.repository';
import { UserModule } from '../user/user.module';
import { UserModel } from '../user/user.repository';
// import { SendLinkItemModel } from './models/send-link-item.model';
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
    UserModule,
    FileModule,
    FolderModule,
    NotificationModule,
  ],
  controllers: [SendController],
  providers: [SequelizeSendRepository, SendUseCases],
})
export class SendModule {}
