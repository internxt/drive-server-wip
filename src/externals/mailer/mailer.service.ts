import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sendgrid from '@sendgrid/mail';
@Injectable()
export class MailerService {
  logger: Logger;
  constructor(
    @Inject(ConfigService)
    private configService: ConfigService,
  ) {
    sendgrid.setApiKey(this.configService.get('mailer.apiKey'));
    this.logger = new Logger();
  }

  async send(email, templateId, context) {
    const msg = {
      to: email,
      from: this.configService.get('mailer.from'),
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
    };
    await sendgrid.send(msg);
  }
}
