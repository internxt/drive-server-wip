import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MailerService } from '../../mailer/mailer.service';
import { SendLinkCreatedEvent } from '../events/send-link-created.event';

@Injectable()
export class SendLinkListener {
  constructor(
    @Inject(MailerService)
    private mailer: MailerService,
  ) {}

  @OnEvent('sendLink.created')
  async handleSendLinkCreated(event: SendLinkCreatedEvent) {
    Logger.log(`event ${event.name} handled`, 'SendLinkListener');
    const { sender, receiver } = event.payload.sendLink;
    Promise.all([
      this.mailer.send(sender, '', {}),
      this.mailer.send(receiver, '', {}),
    ]);
  }
}
