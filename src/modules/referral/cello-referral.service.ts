import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';
import { HttpClient } from '../../externals/http/http.service';
import {
  ReferralService,
  type TrackPurchaseParams,
  type TrackSignupParams,
} from './referral.service';

const HTTP_TIMEOUT_MS = 5000;

@Injectable()
export class CelloReferralService extends ReferralService {
  private readonly logger = new Logger(CelloReferralService.name);
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private tokenRefreshPromise: Promise<{
    accessToken: string;
    expiresIn: number;
  }> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpClient: HttpClient,
  ) {
    super();
  }

  generateToken(productUserId: string): string {
    const productId = this.configService.get<string>('cello.productId');
    const productSecret = this.configService.get<string>('cello.productSecret');

    return sign(
      {
        productId,
        productUserId,
        iat: Math.floor(Date.now() / 1000),
      },
      productSecret,
      { algorithm: 'HS512' },
    );
  }

  async trackPurchaseEvent(params: TrackPurchaseParams): Promise<void> {
    await this.trackSignupEvent({
      ucc: params.ucc,
      userId: params.userId,
      email: params.email,
      name: params.name,
    });

    await this.sendEvent({
      eventName: 'ReferralUpdated',
      payload: {
        ucc: params.ucc,
        newUserId: params.userId,
        price: params.price,
        currency: params.currency,
      },
      context: {
        newUser: {
          id: params.userId,
          email: params.email,
          name: params.name,
        },
        event: {
          trigger: 'invoice-paid',
          timestamp: new Date().toISOString(),
        },
        subscription: {
          id: params.subscriptionId,
          invoiceId: params.invoiceId,
          interval: params.interval,
          productKey: params.productKey,
        },
      },
    });

    this.logger.log(`Cello purchase event sent for user ${params.userId}`);
  }

  private async trackSignupEvent(params: TrackSignupParams): Promise<void> {
    await this.sendEvent({
      eventName: 'ReferralUpdated',
      payload: {
        ucc: params.ucc,
        newUserId: params.userId,
      },
      context: {
        newUser: {
          id: params.userId,
          email: params.email,
          name: params.name,
        },
        event: {
          trigger: 'new-signup',
          timestamp: new Date().toISOString(),
        },
      },
    });

    this.logger.log(`Cello signup event sent for user ${params.userId}`);
  }

  private async sendEvent(body: Record<string, unknown>): Promise<void> {
    const apiUrl = this.configService.get<string>('cello.apiUrl');
    const { accessToken } = await this.getApiAccessToken();

    await this.httpClient.post(`${apiUrl}/events`, body, {
      timeout: HTTP_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  private async getApiAccessToken(): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    const isCachedTokenValid =
      this.accessToken && Date.now() < this.tokenExpiresAt;
    if (isCachedTokenValid) {
      const remainingSeconds = Math.floor(
        (this.tokenExpiresAt - Date.now()) / 1000,
      );
      return { accessToken: this.accessToken, expiresIn: remainingSeconds };
    }

    if (this.tokenRefreshPromise !== null) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = this.fetchApiAccessToken();

    try {
      return await this.tokenRefreshPromise;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  private async fetchApiAccessToken(): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    const apiUrl = this.configService.get<string>('cello.apiUrl');
    const accessKeyId = this.configService.get<string>('cello.productId');
    const secretAccessKey =
      this.configService.get<string>('cello.apiAccessKey');

    const { data } = await this.httpClient.post(
      `${apiUrl}/token`,
      { accessKeyId, secretAccessKey },
      { timeout: HTTP_TIMEOUT_MS },
    );

    this.accessToken = data.accessToken;
    this.tokenExpiresAt = Date.now() + (data.expiresIn - 60) * 1000;

    return { accessToken: data.accessToken, expiresIn: data.expiresIn };
  }
}
