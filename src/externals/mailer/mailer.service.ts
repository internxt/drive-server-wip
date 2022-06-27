import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import InternxtMailer from 'inxt-service-mailer';
@Injectable()
export class MailerService {
  instance: InternxtMailer;
  constructor(
    @Inject(ConfigService)
    private configService: ConfigService,
  ) {
    const mailConfig = {
      sendgrid: {
        api_key: this.configService.get('mailer.apiKey'),
      },
      from: this.configService.get('mailer.from'),
    };
    this.instance = new InternxtMailer(mailConfig);
  }

  send(email, template, context) {
    return new Promise((resolve, reject) => {
      this.instance.dispatchSendGrid(email, template, context, (err) => {
        if (err) {
          return reject(Error(`Could not send verification mail: ${err}`));
        }
        return resolve(true);
      });
    });
  }
}
