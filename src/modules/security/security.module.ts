import { Module } from '@nestjs/common';
import { SequelizeMailLimitRepository } from './mail-limit/mail-limit.repository';
import { SequelizeModule } from '@nestjs/sequelize';
import { MailLimitModel } from './mail-limit/mail-limit.model';

@Module({
  imports: [SequelizeModule.forFeature([MailLimitModel])],
  controllers: [],
  providers: [SequelizeMailLimitRepository],
  exports: [SequelizeMailLimitRepository],
})
export class SecurityModule {}
