import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UserAttributes } from '../../modules/user/user.attributes';
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
    const apiKey: string = this.configService.get('newsletter.apiKey');
    await this.httpClient.post(
      `https://connect.mailerlite.com/api/subscribers`,
      { email, groups: [groupId] },
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          // The following (X-Version) locks up the version of the API (https://developers.mailerlite.com/docs/#versioning)
          'X-Version': '2022-01-01',
        },
      },
    );
  }
}
