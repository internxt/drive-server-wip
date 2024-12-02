import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import SibApiV3Sdk from 'sib-api-v3-sdk';

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

    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const key = defaultClient.authentications['api-key'];
    key.apiKey = apiKey;

    const apiInstance = new SibApiV3Sdk.ContactsApi();
    const createContact = new SibApiV3Sdk.CreateContact();
    createContact.email = email;
    createContact.listIds = [parseInt(groupId)];

    return new Promise((resolve, reject) => {
      apiInstance.createContact(createContact).then(resolve).catch(reject);
    });
  }
}
