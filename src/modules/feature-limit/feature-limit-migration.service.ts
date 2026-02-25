import { Injectable, Logger } from '@nestjs/common';
import { SequelizeUserRepository } from '../user/user.repository';
import { SequelizeFeatureLimitsRepository } from './feature-limit.repository';
import { AxiosError } from 'axios';
import { type User } from '../user/user.domain';
import { PLAN_FREE_TIER_ID } from './limits.enum';
import { type UserAttributes } from '../user/user.attributes';
import { ConfigService } from '@nestjs/config';
import { HttpClient } from '../../externals/http/http.service';
import { Sign } from '../../middlewares/passport';
import extractMessageFromError from '@internxt/lib/dist/src/request/extractMessageFromError';

@Injectable()
export class FeatureLimitsMigrationService {
  private readonly maxRetries = 3; // Max retries allowed to the Payments API before fail.
  private readonly paymentsAPIThrottlingDelay = 1000; // How much time should wait the retry request to payments.

  private planIdTierIdMap: Map<string, string>; // PlanId/tierId mapping

  constructor(
    private readonly userRepository: SequelizeUserRepository,
    private readonly tiersRepository: SequelizeFeatureLimitsRepository,
    private readonly configService: ConfigService,
    private readonly httpClient: HttpClient,
  ) {}

  async start() {
    const limit = 20; // Remember we are tied to Stripe's rate limit, we can not process more than 100 requets per second, so we should aim to a lower limit.
    let processed = 0;
    let lastId = 0;
    let hasMore = true;

    await this.preLoadTiersMap();

    while (hasMore) {
      const users = await this.userRepository.findAllCursorById(
        {},
        lastId,
        limit,
        [['id', 'ASC']],
      );

      for (const user of users) {
        console.time('apply-tier');
        console.log('applying tier for user', user.uuid, user.id);
        await this.assignTierToUser(user);
        console.timeEnd('apply-tier');
      }

      const resultLength = users.length;

      if (resultLength > 0) {
        lastId = users[resultLength - 1].id;
      }

      hasMore = resultLength === limit;

      processed += resultLength;
      Logger.log(
        `[FEATURE_LIMIT_MIGRATION]: Total processed users: ${processed}, lastId: ${lastId} `,
      );
    }

    Logger.log('[FEATURE_LIMIT_MIGRATION]: Tiers applied successfuly.');
  }

  private async assignTierToUser(user: User) {
    try {
      const subscription = await this.getUserSubscriptionWithRetry(user);
      let tierId = this.planIdTierIdMap.get(PLAN_FREE_TIER_ID);

      if (subscription?.planId) {
        if (this.planIdTierIdMap.has(subscription.planId)) {
          tierId = this.planIdTierIdMap.get(subscription.planId);
        } else {
          Logger.error(
            `[FEATURE_LIMIT_MIGRATION/NOT_MAPPED_TIER]: tier planId ${subscription?.planId}  has not mapped tier, applying free tier to user userUuid: ${user.uuid} email: ${user.email}`,
          );
        }
      }

      // The only one update action
      await this.userRepository.updateBy(
        { uuid: user.uuid },
        {
          tierId,
        },
      );
    } catch (error) {
      Logger.error(
        `[FEATURE_LIMIT_MIGRATION/ERROR]: error applying applying tier to user userUuid: ${
          user.uuid
        } email: ${user.email}  error: ${extractMessageFromError(error)}`,
      );
    }
  }

  private async getUserSubscriptionWithRetry(user: User, retries = 0) {
    try {
      const subscription = await this.getCurrentSubscription(user.uuid);
      return subscription;
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response && error.response.status === 404) {
          return;
        }

        if (error.response && error.response.status === 429) {
          if (retries < this.maxRetries) {
            Logger.warn(
              `[FEATURE_LIMIT_MIGRATION/PAYMENTS_REQUEST]: Throttling detected, waiting for 1 minute for payments API throttling retry number: ${
                retries + 1
              }`,
            );
            await this.delay(this.paymentsAPIThrottlingDelay);
            return this.getUserSubscriptionWithRetry(user, retries + 1);
          }
        }
      }
      Logger.error(
        `[FEATURE_LIMIT_MIGRATION/PAYMENTS_REQUEST]: error getting user plan userUuid: ${user.uuid} email: ${user.email}  error: ${error.message}`,
      );
      throw error;
    }
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
      `${this.configService.get('apis.payments.url')}/get-user-subscription`,
      params,
    );
    return res.data;
  }

  private async preLoadTiersMap() {
    this.planIdTierIdMap = new Map();

    const tiers = await this.tiersRepository.findAllPlansTiersMap();
    tiers.forEach((tier) => {
      this.planIdTierIdMap.set(tier.planId, tier.tierId);
    });

    if (!this.planIdTierIdMap.get(PLAN_FREE_TIER_ID)) {
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
