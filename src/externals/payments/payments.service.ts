import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { UserAttributes } from '../../modules/user/user.attributes';
import { HttpClient } from '../http/http.service';
import { Sign } from '../../middlewares/passport';

@Injectable()
export class PaymentsService {
  private provider: Stripe;

  constructor(
    @Inject(ConfigService)
    private configService: ConfigService,
    @Inject(HttpClient)
    private httpClient: HttpClient,
  ) {
    const stripeTest = new Stripe(process.env.STRIPE_SK_TEST, {
      apiVersion: '2023-10-16',
    });
    const stripeProduction = new Stripe(process.env.STRIPE_SK, {
      apiVersion: '2023-10-16',
    });
    this.provider = configService.get('isProduction')
      ? stripeProduction
      : stripeTest;
  }

  private async findCustomersByEmail(
    email: UserAttributes['email'],
  ): Promise<Stripe.Customer[]> {
    const { data: customers } = await this.provider.customers.list({ email });

    return customers;
  }

  async hasSubscriptions(email: UserAttributes['email']): Promise<boolean> {
    const customers = await this.findCustomersByEmail(email);

    for (const customer of customers) {
      const allCustomerSubscriptions = await this.provider.subscriptions.list({
        customer: customer.id,
        status: 'all',
        expand: ['data.plan.product'],
      });

      if (allCustomerSubscriptions.data.length > 0) {
        return true;
      }
    }

    return false;
  }

  async getCurrentSubscription(uuid: UserAttributes['uuid']) {
    const jwt = Sign(
      { payload: { uuid } },
      this.configService.get('secrets.jwt'),
    );

    const params = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
    };

    const res = await this.httpClient.get(
      `${this.configService.get('apis.payments.url')}/subscriptions`,
      params,
    );
    return res.data;
  }
}
