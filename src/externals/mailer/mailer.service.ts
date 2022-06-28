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
      from: this.configService.get('mailer.from'),
      subject: '',
      text: '',
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
