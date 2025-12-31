import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface CheckoutData {
  checkoutUrl: string;
  planName?: string;
  price?: number;
}

@Injectable()
export class KlaviyoTrackingService {
  private readonly logger = new Logger(KlaviyoTrackingService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('klaviyo.apiKey');
    this.baseUrl = this.configService.get<string>('klaviyo.baseUrl');
  }

  async trackCheckoutStarted(
    email: string,
    checkoutData: CheckoutData,
  ): Promise<void> {
    try {
      const payload = {
        data: {
          type: 'event',
          attributes: {
            profile: {
              data: {
                type: 'profile',
                attributes: {
                  email,
                },
              },
            },
            metric: {
              data: {
                type: 'metric',
                attributes: {
                  name: 'Started Checkout',
                },
              },
            },
            properties: {
              checkout_url: checkoutData.checkoutUrl,
              plan_name: checkoutData.planName,
              price: checkoutData.price,
              $value: checkoutData.price,
            },
            time: new Date().toISOString(),
          },
        },
      };

      await axios.post(`${this.baseUrl}/events/`, payload, {
        headers: {
          Authorization: `Klaviyo-API-Key ${this.apiKey}`,
          'Content-Type': 'application/json',
          revision: '2024-10-15',
        },
      });

      this.logger.log(`Checkout event tracked for ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to track checkout for ${email}: ${error.message}`,
      );
      throw error;
    }
  }
}
