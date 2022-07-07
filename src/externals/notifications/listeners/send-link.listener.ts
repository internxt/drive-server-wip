import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { MailerService } from '../../mailer/mailer.service';
import { SendLinkCreatedEvent } from '../events/send-link-created.event';
import pretty from 'prettysize';
@Injectable()
export class SendLinkListener {
  constructor(
    @Inject(MailerService)
    private mailer: MailerService,
    @Inject(ConfigService)
    private configService: ConfigService,
  ) {}

  @OnEvent('sendLink.created')
  async handleSendLinkCreated(event: SendLinkCreatedEvent) {
    Logger.log(`event ${event.name} handled`, 'SendLinkListener');
    const { sender, receivers, items, title, subject, expirationAt, size, id } =
      event.payload.sendLink;

    if (!sender || !receivers) return;

    const itemsToMail = items.map((item) => {
      return {
        name: item.name,
        size: pretty(item.size),
      };
    });
    const sizeFormated = pretty(size);
    try {
      await this.mailer.send(
        sender,
        this.configService.get('mailer.templates.sendLinkCreateSender'),
        {
          sender,
          receivers,
          items: itemsToMail,
          count: items.length,
          title,
          message: subject,
          expirationDate: expirationAt,
          size: sizeFormated,
          token: id,
        },
      );

      for (const receiver of receivers) {
        await this.mailer.send(
          receiver,
          this.configService.get('mailer.templates.sendLinkCreateReceiver'),
          {
            sender,
            items: itemsToMail,
            count: items.length,
            title,
            message: subject,
            expirationDate: expirationAt,
            size: sizeFormated,
            token: id,
          },
        );
      }
    } catch (err) {
      Logger.error(err, 'SendLinkListener');
    }
  }
}
