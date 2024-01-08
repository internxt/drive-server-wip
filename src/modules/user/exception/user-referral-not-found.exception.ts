import { HttpStatus } from '@nestjs/common';
import { UserException } from './user.exception';

export class UserReferralNotFoundException extends UserException {
  constructor(message?: string) {
    super(
      message ?? 'UserReferral: not found',
      HttpStatus.NOT_FOUND,
      'USER_REFERRAL_NOT_FOUND',
    );
  }
}
