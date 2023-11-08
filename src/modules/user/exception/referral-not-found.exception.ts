import { UserException } from './user.exception';

export class ReferralNotFoundException extends UserException {
  constructor(message?: string) {
    super(message ?? 'Referral: not found');
  }
}
