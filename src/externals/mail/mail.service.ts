import { Inject, Injectable } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { HttpClient } from '../http/http.service';

interface CreateAccountPayload {
  userId: string;
  address: string;
  domain: string;
  displayName: string;
}

interface CreateAccountResponse {
  address: string;
  domain: string;
}

function signToken(duration: string, secret: string, isDevelopment?: boolean) {
  return sign({}, Buffer.from(secret, 'base64').toString('utf8'), {
    algorithm: 'RS256',
    expiresIn: duration,
    ...(isDevelopment ? { allowInsecureKeySizes: true } : null),
  });
}

@Injectable()
export class MailService {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(HttpClient)
    private readonly httpClient: HttpClient,
  ) {}

  private getAuthHeaders() {
    const isDevelopment = this.configService.get('isDevelopment');
    const jwt = signToken(
      '5m',
      this.configService.get('secrets.gateway'),
      isDevelopment,
    );

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    };
  }

  async createAccount(
    payload: CreateAccountPayload,
  ): Promise<CreateAccountResponse> {
    const baseUrl = this.configService.get('apis.mail.url');
    const headers = this.getAuthHeaders();

    const res = await this.httpClient.post(
      `${baseUrl}/gateway/accounts`,
      payload,
      { headers },
    );

    return res.data;
  }
}
