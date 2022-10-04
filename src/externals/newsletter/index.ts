import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UserAttributes } from 'src/modules/user/user.domain';
import { HttpClient } from '../http/http.service';

@Injectable()
export class NewsletterService {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    private readonly httpClient: HttpClient,
  ) {}

  async subscribe(email: UserAttributes['email']): Promise<void> {
    const groupId: string = this.configService.get('newsletter.groupId');

    await this.httpClient.post(
      `https://api.mailerlite.com/api/v2/groups/${groupId}/subscribers`,
      { email, resubscribe: true, autoresponders: true },
      {
        headers: {
          Accept: 'application/json',
          'X-MailerLite-ApiDocs': 'true',
          'Content-Type': 'application/json',
          'X-MailerLite-ApiKey': this.configService.get('newsletter.apiKey'),
        },
      },
    );
  }
}
