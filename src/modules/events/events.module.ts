import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailerService } from '../../externals/mailer/mailer.service';
import { EventsController } from './events.controller';
import { EventsUseCases } from './events.usecase';

@Module({
  imports: [ConfigModule],
  controllers: [EventsController],
  providers: [MailerService, EventsUseCases],
  exports: [EventsUseCases],
})
export class EventsModule {}
