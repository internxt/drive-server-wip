import { HttpException, HttpStatus } from '@nestjs/common';

export class PaymentRequiredException extends HttpException {
  constructor(message?: string) {
    super(
      message ??
        'It seems you reached the limit or feature is not available for your current plan tier',
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
