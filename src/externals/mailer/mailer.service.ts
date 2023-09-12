import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sendgrid from '@sendgrid/mail';
import { User } from '../../modules/user/user.domain';
import { Folder } from '../../modules/folder/folder.domain';
import { File } from '../../modules/file/file.domain';

type SendInvitationToSharingContext = {
  notification_message: string;
  item_name: string;
  sender_email: string;
  accept_url: string;
  decline_url: string;
};

@Injectable()
export class MailerService {
  constructor(
    @Inject(ConfigService)
    private configService: ConfigService,
  ) {
    sendgrid.setApiKey(this.configService.get('mailer.apiKey'));
  }

  async send(email, templateId, context) {
    const msg = {
      to: email,
      from: {
        email: this.configService.get('mailer.from'),
        name: this.configService.get('mailer.name'),
      },
      subject: '',
      text: 'send link',
      html: 'send link',
      personalizations: [
        {
          to: [
            {
              email,
            },
          ],
          dynamic_template_data: context,
        },
      ],
      template_id: templateId,
      mail_settings: {
        sandbox_mode: {
          enable: this.configService.get('mailer.sandbox'),
        },
      },
    };
    await sendgrid.send(msg);
  }

  async sendInvitationToSharingReceivedEmail(
    ownerOfTheItemEmail: User['email'],
    invitedUserEmail: User['email'],
    itemName: File['plainName'] | Folder['plainName'],
    mailInfo: {
      acceptUrl: string;
      declineUrl: string;
      message: string;
    },
  ): Promise<void> {
    const context: SendInvitationToSharingContext = {
      sender_email: ownerOfTheItemEmail,
      accept_url: mailInfo.acceptUrl,
      decline_url: mailInfo.declineUrl,
      item_name: itemName,
      notification_message: mailInfo.message,
    };
    await this.send(
      invitedUserEmail,
      this.configService.get('mailer.templates.invitationToSharingReceived'),
      context,
    );
  }
}
