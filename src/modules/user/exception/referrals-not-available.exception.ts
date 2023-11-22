import { UserException } from './user.exception';

export class ReferralsNotAvailableException extends UserException {
  constructor(message?: string) {
    super(message ?? 'Referrals: not available');
  }
}
