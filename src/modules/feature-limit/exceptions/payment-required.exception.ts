import { HttpException, HttpStatus } from '@nestjs/common';

export enum PaymentRequiredErrorCode {
  FileUploadSizeExceeded = 'FILE_UPLOAD_SIZE_EXCEEDED',
  FeatureNotAvailable = 'FEATURE_NOT_AVAILABLE',
}

export class PaymentRequiredException extends HttpException {
  constructor(message?: string, code?: PaymentRequiredErrorCode) {
    super(
      {
        message:
          message ??
          'It seems you reached the limit or feature is not available for your current plan tier',
        ...(code ? { error: code } : {}),
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
