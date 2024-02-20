import { Injectable, Logger } from '@nestjs/common';
import { SequelizeUserRepository } from '../user/user.repository';
import { SequelizeFeatureLimitsRepository } from './feature-limit.repository';
import { AxiosError } from 'axios';
import { User } from '../user/user.domain';
import { PaymentsService } from 'src/externals/payments/payments.service';

const FREE_TIER_ID = 'free_000000';

@Injectable()
export class FeatureLimitsMigrationService {
  private readonly delayBetweenUsers = 10;
  private readonly maxRetries = 3;
  private readonly paymentsAPIThrottlingDelay = 60000;

  private planIdTierIdMap: Map<string, string>; // PlanId/tierId mapping

  constructor(
    private userRepository: SequelizeUserRepository,
    private tiersRepository: SequelizeFeatureLimitsRepository,
    private paymentsService: PaymentsService,
  ) {}

  async asignTiersToUsers() {
    const limit = 20;
    let offset = 0;
    let processed = 0;
    await this.loadTiers();

    while (true) {
      const users = await this.userRepository.findAllByWithPagination(
        { tierId: null },
        limit,
        offset,
      );

      if (users.length === 0) {
        break;
      }

      for (const user of users) {
        await this.assignTier(user);
        await this.delay(this.delayBetweenUsers); // Delay between requests to prevent Stripe Throttling
      }

      processed += users.length;
      Logger.log(
        `[FEATURE_LIMIT_MIGRATION]: Processed : ${processed}, current offset: ${offset} `,
      );
      offset += limit;
    }
    Logger.log('[FEATURE_LIMIT_MIGRATION]: Tiers applied successfuly.');
  }

  private async assignTier(user: User) {
    try {
      const subscription = await this.getUserSubscription(user);
      let tierId = this.planIdTierIdMap.get(FREE_TIER_ID);

      if (subscription?.priceId) {
        if (this.planIdTierIdMap.has(subscription.priceId)) {
          tierId = this.planIdTierIdMap.get(subscription.priceId);
        } else {
          Logger.error(
            `[FEATURE_LIMIT_MIGRATION/NOT_MAPPED_TIER]: tier priceId ${subscription?.priceId}  has not mapped tier, applying free tier to user userUuid: ${user.uuid} email: ${user.email}`,
          );
        }
      }

      await this.userRepository.updateBy(
        { uuid: user.uuid },
        {
          tierId,
        },
      );
    } catch (error) {
      Logger.error(
        `[FEATURE_LIMIT_MIGRATION/ERROR]: error applying applying tier to user userUuid: ${user.uuid} email: ${user.email}  error: ${error.message}`,
      );
    }
  }

  private async getUserSubscription(user: User, retries = 0) {
    try {
      const subscription = await this.paymentsService.getCurrentSubscription(
        user.uuid,
      );
      return subscription;
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response && error.response.status === 404) {
          return;
        } else if (error.response && error.response.status === 429) {
          if (retries < this.maxRetries) {
            Logger.warn(
              `[FEATURE_LIMIT_MIGRATION/PAYMENTS_REQUEST]: Throttling detected, waiting for 1 minute for payments API throttling retry number: ${
                retries + 1
              }`,
            );
            await this.delay(this.paymentsAPIThrottlingDelay);
            return this.getUserSubscription(user, retries + 1);
          }
        }
      }
      Logger.error(
        `[FEATURE_LIMIT_MIGRATION/PAYMENTS_REQUEST]: error getting user plan userUuid: ${user.uuid} email: ${user.email}  error: ${error.message}`,
      );
      throw error;
    }
  }

  private async loadTiers() {
    this.planIdTierIdMap = new Map();

    const tiers = await this.tiersRepository.findAllPlansTiersMap();
    tiers.forEach((tier) => {
      this.planIdTierIdMap.set(tier.planId, tier.tierId);
    });

    if (!this.planIdTierIdMap.get(FREE_TIER_ID)) {
      Logger.error(
        `[FEATURE_LIMIT_MIGRATION/NO_FREE]: No free tier mapped found, please add a tier for free users to your DB`,
      );
      throw Error(
        'There is no free tier mapped, please add a tier for free users',
      );
    }
  }

  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
