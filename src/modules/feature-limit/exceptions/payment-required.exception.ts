import { HttpException, HttpStatus } from '@nestjs/common';

export class PaymentRequiredException extends HttpException {
  constructor(message?: string) {
    super(
      message ?? 'It seems you reached the limit for your current plan tier',
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
