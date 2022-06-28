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
    console.log(event.payload.sendLink);

    const itemsToMail = items.map((item) => {
      return {
        name: `${item.name}.${item.type}`,
        size: item.size,
      };
    });
    console.log(receivers);
    for (const receiver of receivers) {
      await this.mailer.send(receiver, 'd-7889146930fa421083b4bf1cdcaedab3', {
        sender,
        items: itemsToMail,
        count: items.length,
        link,
        title,
        message: subject,
        expirationDate: expirationAt,
        size,
      });
    }
    // await this.mailer.send(sender, '', {
    //   sender,
    //   receivers,
    //   items: itemsToMail,
    //   link,
    //   title,
    //   subject,
    // });
  }
}
