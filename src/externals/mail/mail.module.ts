import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpClientModule } from '../http/http.module';
import { MailService } from './mail.service';

@Module({
  imports: [ConfigModule, HttpClientModule],
  controllers: [],
  providers: [MailService],
  exports: [MailService],
})
export class MailServiceModule {}
