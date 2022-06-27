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
    const {
      sender,
      receivers,
      items,
      link,
      title,
      subject,
      expirationAt,
      size,
    } = event.payload.sendLink;

    const itemsToMail = items.map((item) => {
      return {
        title: item.name,
        type: item.type,
        size: item.size,
      };
    });

    for (const receiver of receivers) {
      await this.mailer.send(receiver, 'sendLink', {
        sender,
        items: itemsToMail,
        count: items.length,
        link,
        title,
        message: subject,
        date: expirationAt,
        size,
      });
    }
    await this.mailer.send(sender, '', {
      sender,
      receivers,
      items: itemsToMail,
      link,
      title,
      subject,
    });
  }
}
