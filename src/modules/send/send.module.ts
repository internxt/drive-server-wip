import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserModule } from '../user/user.module';
import { UserModel } from '../user/user.repository';
import { SendLinkItemModel } from './models/send-link-item.model';
import { SendLinkModel } from './models/send-link.model';
import { SequelizeSendRepository } from './send-link.repository';

@Module({
  imports: [
    SequelizeModule.forFeature([SendLinkItemModel, SendLinkModel, UserModel]),
    UserModule,
  ],
  controllers: [],
  providers: [SequelizeSendRepository],
})
export class SendModule {}
