import { Inject, Injectable } from '@nestjs/common';
import { signWithExpiry } from '../../middlewares/passport';
import { ConfigService } from '@nestjs/config';
import { HttpClient } from '../http/http.service';

const MAIL_USAGE_REQUEST_TIMEOUT_MS = 3000;

function signToken(duration: string, secret: string, isDevelopment?: boolean) {
  return signWithExpiry({}, Buffer.from(secret, 'base64').toString('utf8'), {
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

  async findUserIdByAddress(address: string): Promise<string | null> {
    const baseUrl = this.configService.get('apis.mail.url');
    const headers = this.getAuthHeaders();

    try {
      const res = await this.httpClient.get(
        `${baseUrl}/gateway/addresses/${encodeURIComponent(address)}`,
        { headers },
      );

      return res.data?.userId ?? null;
    } catch (error) {
      if (error?.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }
  async getUserMailUsage(userUuid: string): Promise<number> {
    const baseUrl = this.configService.get('apis.mail.url');
    const headers = this.getAuthHeaders();

    const res = await this.httpClient.get(
      `${baseUrl}/gateway/accounts/${encodeURIComponent(userUuid)}/usage`,
      { headers, timeout: MAIL_USAGE_REQUEST_TIMEOUT_MS },
    );

    const usage = res.data?.usage;

    if (typeof usage !== 'number' || !Number.isFinite(usage)) {
      throw new Error(
        `Mail gateway returned a malformed usage payload for user ${userUuid}`,
      );
    }

    return usage;
  }
}
