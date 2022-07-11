import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sendgrid from '@sendgrid/mail';
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
        name: this.configService.get('mailer.name')
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
}
