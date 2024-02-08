import { HttpStatus } from '@nestjs/common';
import { UserException } from './user.exception';

export class ReferralsNotAvailableException extends UserException {
  constructor(message?: string) {
    super(
      message ?? 'Referrals: not available',
      HttpStatus.BAD_REQUEST,
      'REFERRALS_NOT_AVAILABLE',
    );
  }
}
