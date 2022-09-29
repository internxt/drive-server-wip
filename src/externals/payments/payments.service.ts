import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { UserAttributes } from '../../modules/user/user.domain';

@Injectable()
export class PaymentsService {
  private provider: Stripe;

  constructor(
    @Inject(ConfigService)
    configService: ConfigService,
  ) {
    const stripeTest = new Stripe(process.env.STRIPE_SK_TEST, {
      apiVersion: '2020-08-27',
    });
    const stripeProduction = new Stripe(process.env.STRIPE_SK, {
      apiVersion: '2020-08-27',
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
}
