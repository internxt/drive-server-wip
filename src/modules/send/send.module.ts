import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { HttpClientModule } from '../../externals/http/http.module';
import { NewsletterService } from '../../externals/newsletter';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { FolderModel } from '../folder/folder.model';
import { UserModule } from '../user/user.module';
import { UserModel } from '../user/user.model';
import {
  SendLinkItemModel,
  SendLinkModel,
  SequelizeSendRepository,
} from './send-link.repository';
import { SendController } from './send.controller';
import { SendUseCases } from './send.usecase';
import { FileModel } from '../file/file.model';
import { CaptchaService } from '../../externals/captcha/captcha.service';

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
    forwardRef(() => FileModule),
    FolderModule,
    NotificationModule,
    CryptoModule,
    HttpClientModule,
  ],
  controllers: [SendController],
  providers: [
    SequelizeSendRepository,
    SendUseCases,
    CaptchaService,
    NewsletterService,
  ],
})
export class SendModule {}
