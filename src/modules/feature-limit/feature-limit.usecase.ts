import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { LimitLabels } from './limits.enum';
import { type User } from '../user/user.domain';
import { SequelizeFeatureLimitsRepository } from './feature-limit.repository';
import { SequelizeSharingRepository } from '../sharing/sharing.repository';
import { SharingType } from '../sharing/sharing.domain';
import { type Limit } from './domain/limit.domain';
import {
  type LimitTypeMapping,
  type MaxInviteesPerItemAttribute,
  type MaxSharedItemsAttribute,
} from './domain/limits.attributes';
import { PaymentRequiredException } from './exceptions/payment-required.exception';

@Injectable()
export class FeatureLimitUsecases {
  constructor(
    private readonly limitsRepository: SequelizeFeatureLimitsRepository,
    private readonly sharingRepository: SequelizeSharingRepository,
  ) {}

  private readonly limitCheckFunctions: {
    [K in LimitLabels]?: (params: {
      limit: Limit;
      data: LimitTypeMapping[K];
      user: User;
    }) => Promise<boolean>;
  } = {
    [LimitLabels.MaxSharedItems]: this.checkMaxSharedItemsLimit.bind(this),
    [LimitLabels.MaxSharedItemInvites]:
      this.checkMaxInviteesPerItemLimit.bind(this),
  };

  async enforceLimit<T extends keyof LimitTypeMapping>(
    limitLabel: LimitLabels,
    user: User,
    data: LimitTypeMapping[T],
  ): Promise<boolean> {
    let limit = await this.limitsRepository.findUserOverriddenLimit(
      user.uuid,
      limitLabel,
    );

    if (!limit) {
      limit = await this.limitsRepository.findLimitByLabelAndTier(
        user.tierId,
        limitLabel,
      );
    }

    if (!limit) {
      new Logger().error(
        `[FEATURE_LIMIT]: Limit not found for label: ${limitLabel}, tierId: ${user.tierId} user: ${user.email}`,
      );
      throw new InternalServerErrorException();
    }

    if (limit.isBooleanLimit()) {
      if (limit.shouldLimitBeEnforced()) {
        throw new PaymentRequiredException(
          `Feature not available for ${limitLabel} `,
        );
      }
      return false;
    }

    const isLimitSurprassed = await this.checkCounterLimit(user, limit, data);
    if (isLimitSurprassed) {
      throw new PaymentRequiredException(`Limit exceeded for ${limitLabel} `);
    }
    return false;
  }

  async checkCounterLimit<T extends keyof LimitTypeMapping>(
    user: User,
    limit: Limit,
    data: LimitTypeMapping[T],
  ) {
    const checkFunction = this.limitCheckFunctions[limit.label];

    if (!checkFunction) {
      new Logger().error(
        `[FEATURE-LIMIT] Check counter function not defined for label: ${limit.label}.`,
      );
      throw new InternalServerErrorException();
    }
    return checkFunction({ limit, data, user });
  }

  async checkMaxSharedItemsLimit({
    limit,
    user,
    data,
  }: {
    limit: Limit;
    user: User;
    data: MaxSharedItemsAttribute;
  }) {
    const limitContext = { bypassLimit: false, currentCount: 0 };
    const alreadySharedItem = await this.sharingRepository.findOneSharingBy({
      itemId: data.itemId,
    });

    if (alreadySharedItem) {
      limitContext.bypassLimit = true;
    } else {
      const sharingsCount =
        await this.sharingRepository.getSharedItemsNumberByUser(user.uuid);
      limitContext.currentCount = sharingsCount;
    }

    return limit.shouldLimitBeEnforced(limitContext);
  }

  async checkMaxInviteesPerItemLimit({
    limit,
    data,
  }: {
    limit: Limit;
    data: MaxInviteesPerItemAttribute;
  }) {
    const limitContext = { currentCount: 0 };
    const { itemId, itemType } = data;

    const [sharingsCountForThisItem, invitesCountForThisItem] =
      await Promise.all([
        this.sharingRepository.getSharingsCountBy({
          itemId,
          itemType,
          type: SharingType.Private,
        }),
        this.sharingRepository.getInvitesCountBy({
          itemId,
          itemType,
        }),
      ]);

    // Add 1 to include owner in the limit count.
    limitContext.currentCount =
      sharingsCountForThisItem + invitesCountForThisItem + 1;

    return limit.shouldLimitBeEnforced(limitContext);
  }

  async getLimitByLabelAndTier(label: string, tierId: string) {
    return this.limitsRepository.findLimitByLabelAndTier(tierId, label);
  }
}
