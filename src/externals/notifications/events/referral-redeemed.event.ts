import { type ReferralAttributes } from '../../../modules/user/user.domain';
import { type UserAttributes } from '../../../modules/user/user.attributes';
import { Event } from './event';

export class ReferralRedeemedEvent extends Event {
  public uuid: UserAttributes['uuid'];
  public referralKey: ReferralAttributes['key'];

  constructor(
    uuid: UserAttributes['uuid'],
    referralKey: ReferralAttributes['key'],
  ) {
    super('referral.redeemed', {});

    this.uuid = uuid;
    this.referralKey = referralKey;
  }
}
