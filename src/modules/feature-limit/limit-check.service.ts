import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { LimitLabels } from './limits.enum';
import { User } from '../user/user.domain';
import { SequelizeFeatureLimitsRepository } from './feature-limit.repository';
import { SequelizeSharingRepository } from '../sharing/sharing.repository';
import { SharingType } from '../sharing/sharing.domain';
import { Limit } from './limit.domain';
import {
  LimitTypeMapping,
  MaxInviteesPerItemAttribute,
} from './limits.attributes';

@Injectable()
export class LimitCheckService {
  constructor(
    private readonly limitsRepository: SequelizeFeatureLimitsRepository,
    private readonly sharingRepository: SequelizeSharingRepository,
  ) {}

  private checkFunctions: {
    [K in LimitLabels]: (params: {
      limit: Limit;
      data: LimitTypeMapping[K];
      user: User;
    }) => Promise<boolean>;
  } = {
    [LimitLabels.MaxSharedItems]: this.isMaxSharedItemsLimitExceeded.bind(this),
    [LimitLabels.MaxSharedItemInvites]:
      this.isMaxInviteesPerItemsLimitExceeded.bind(this),
  };

  checkLimit<T extends keyof LimitTypeMapping>(
    user: User,
    limit: Limit,
    data: LimitTypeMapping[T],
  ) {
    const checkFunction = this.checkFunctions[limit.label as LimitLabels];
    if (!checkFunction) {
      new Logger().error(
        `Check function not defined for label: ${limit.label}.`,
      );
      return false;
    }
    return checkFunction({ limit, data, user });
  }

  async isMaxSharedItemsLimitExceeded({
    limit,
    user,
  }: {
    limit: Limit;
    user: User;
  }) {
    const sharingsNumber =
      await this.sharingRepository.getSharedItemsNumberByUser(user.uuid);
    const limitExceeded = sharingsNumber >= limit.value;
    if (limitExceeded) {
      throw new BadRequestException('You reached the limit of shared items');
    }
    return false;
  }

  async isMaxInviteesPerItemsLimitExceeded({
    limit,
    data,
  }: {
    limit: Limit;
    data: MaxInviteesPerItemAttribute;
  }) {
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

    const count = sharingsCountForThisItem + invitesCountForThisItem;

    const limitExceeded = count >= limit.value;
    if (limitExceeded) {
      throw new BadRequestException(
        'You reached the limit of invitations for this item',
      );
    }
    return false;
  }

  async getLimitByLabelAndTier(label: string, tierId: string) {
    return this.limitsRepository.findLimitByLabelAndTier(
      'dfd536ca-7284-47ff-800f-957a80d98084',
      label,
    );
  }
}
