import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserModule } from '../user/user.module';
import { UserModel } from '../user/user.repository';
import {
  SendLinkItemModel,
  SendLinkModel,
  SequelizeSendRepository,
} from './send-link.repository';

@Module({
  imports: [
    SequelizeModule.forFeature([SendLinkModel, SendLinkItemModel, UserModel]),
    UserModule,
  ],
  controllers: [],
  providers: [SequelizeSendRepository],
})
export class SendModule {}
