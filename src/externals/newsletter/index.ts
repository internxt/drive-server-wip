import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type UserAttributes } from '../../modules/user/user.attributes';
import { HttpClient } from '../http/http.service';

export interface NewsletterProfileLocation {
  ip?: string;
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
}

@Injectable()
export class NewsletterService {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    private readonly httpClient: HttpClient,
  ) {}

  async subscribe(
    email: UserAttributes['email'],
    listId?: string,
    location?: NewsletterProfileLocation,
  ): Promise<void> {
    const resolvedListId =
      listId ?? this.configService.get('newsletter.listId');
    const apiKey: string = this.configService.get('newsletter.apiKey');
    const baseUrl: string = this.configService.get('klaviyo.baseUrl');

    const profileResponse = await this.httpClient.post(
      `${baseUrl}profiles/`,
      {
        data: {
          type: 'profile',
          attributes: this.buildProfileAttributes(email, location),
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
      `${baseUrl}lists/${resolvedListId}/relationships/profiles/`,
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

  private buildProfileAttributes(
    email: UserAttributes['email'],
    location?: NewsletterProfileLocation,
  ) {
    const resolved = Object.fromEntries(
      Object.entries(location ?? {}).filter(
        ([, value]) => value !== undefined && value !== null && value !== '',
      ),
    );

    return Object.keys(resolved).length > 0
      ? { email, location: resolved }
      : { email };
  }
}
