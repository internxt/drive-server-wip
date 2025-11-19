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
    const listId: string = this.configService.get('newsletter.groupId');
    const apiKey: string = this.configService.get('newsletter.apiKey');

    const profileResponse = await this.httpClient.post(
      'https://a.klaviyo.com/api/profiles/',
      {
        data: {
          type: 'profile',
          attributes: { email },
        },
      },
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Klaviyo-API-Key ${apiKey}`,
          'Content-Type': 'application/json',
          revision: '2024-10-15',
        },
      },
    );

    const profileId = profileResponse.data.data.id;

    await this.httpClient.post(
      `https://a.klaviyo.com/api/lists/${listId}/relationships/profiles/`,
      { data: [{ type: 'profile', id: profileId }] },
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Klaviyo-API-Key ${apiKey}`,
          'Content-Type': 'application/json',
          revision: '2024-10-15',
        },
      },
    );
  }
}
