import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AttemptChangeEmailModel } from './attempt-change-email.model';
import { AttemptChangeEmailRepository } from './attempt-change-email.repository';
import { AttemptChangeEmailController } from './attempt-change-email.controller';
import { AttemptChangeEmailUseCase } from './attempt-change-email.usecase';
import { UserModule } from '../user.module';
import { MailerModule } from 'src/externals/mailer/mailer.module';
import { CryptoModule } from 'src/externals/crypto/crypto.module';

@Module({
  controllers: [AttemptChangeEmailController],
  imports: [
    SequelizeModule.forFeature([AttemptChangeEmailModel]),
    forwardRef(() => UserModule),
    MailerModule,
    CryptoModule,
  ],
  providers: [AttemptChangeEmailUseCase, AttemptChangeEmailRepository],
})
export class AttemptChangeEmailModule {}
