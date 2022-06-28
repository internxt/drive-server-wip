import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { ConfigModule } from '@nestjs/config';
import { HttpClientModule } from '../http/http.module';
@Module({
  imports: [ConfigModule, HttpClientModule],
  controllers: [],
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
