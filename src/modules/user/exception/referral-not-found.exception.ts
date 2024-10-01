import { HttpStatus } from '@nestjs/common';
import { UserException } from './user.exception';

export class ReferralNotFoundException extends UserException {
  constructor(message?: string) {
    super(
      message ?? 'Referral: not found',
      HttpStatus.NOT_FOUND,
      'REFERRAL_NOT_FOUND',
    );
  }
}
