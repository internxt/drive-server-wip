import { HttpException, HttpStatus } from '@nestjs/common';
import { LimitLabels, LimitsErrorCodes } from '../limits.enum';

export class PaymentRequiredException extends HttpException {
  constructor(message?: string, code?: LimitLabels) {
    super(
      {
        code: LimitsErrorCodes[code] ?? LimitsErrorCodes['Default'],
        message:
          message ??
          'It seems you reached the limit or feature is not available for your current plan tier',
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
