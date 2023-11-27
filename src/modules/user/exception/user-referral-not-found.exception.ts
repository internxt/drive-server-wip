import { UserException } from './user.exception';

export class UserReferralNotFoundException extends UserException {
  constructor(message?: string) {
    super(message ?? 'UserReferral: not found');
  }
}
