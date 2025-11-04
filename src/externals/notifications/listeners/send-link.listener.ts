import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { MailerService } from '../../mailer/mailer.service';
import { SendLinkCreatedEvent } from '../events/send-link-created.event';
import pretty from 'prettysize';
import { stringUtils } from '@internxt/lib';

@Injectable()
export class SendLinkListener {
  constructor(
    @Inject(MailerService)
    private readonly mailer: MailerService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  @OnEvent('sendLink.created')
  async handleSendLinkCreated(event: SendLinkCreatedEvent) {
    Logger.log(`event ${event.name} handled`, 'SendLinkListener');
    const {
      sender,
      receivers,
      items,
      title,
      subject,
      expirationAt,
      size,
      id,
      plainCode,
      totalFiles,
    } = event.payload.sendLink;

    if (!sender || !receivers) return;

    const itemsToMail: { name: string; size: string }[] = items
      .filter((item) => {
        return (
          !item.parent_folder || String(item.parent_folder).trim().length === 0
        );
      })
      .map((item) => {
        return {
          name: item.name,
          size: pretty(item.size),
        };
      });
    const sizeFormated = pretty(size);
    try {
      const encodedId = stringUtils.encodeV4Uuid(id);
      const downloadURL = `/d/${encodedId}/${plainCode}`;

      await this.mailer.send(
        sender,
        this.configService.get('mailer.templates.sendLinkCreateSender'),
        {
          sender,
          receivers,
          items: itemsToMail,
          count: totalFiles,
          title,
          message: subject,
          expirationDate: expirationAt,
          size: sizeFormated,
          token: downloadURL,
        },
      );

      for (const receiver of receivers) {
        await this.mailer.send(
          receiver,
          this.configService.get('mailer.templates.sendLinkCreateReceiver'),
          {
            sender,
            items: itemsToMail,
            count: totalFiles,
            title,
            message: subject,
            expirationDate: expirationAt,
            size: sizeFormated,
            token: downloadURL,
          },
        );
      }
    } catch (err) {
      Logger.error(err, 'SendLinkListener');
    }
  }
}
