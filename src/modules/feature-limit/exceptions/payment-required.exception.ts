import { HttpException, HttpStatus } from '@nestjs/common';

export enum PaymentRequiredErrorCode {
  FileUploadSizeExceeded = 'FILE_UPLOAD_SIZE_EXCEEDED',
  EmptyFilesNotInPlan = 'EMPTY_FILES_NOT_IN_PLAN',
  FeatureNotInPlan = 'FEATURE_NOT_IN_PLAN',
  PlanLimitExceeded = 'PLAN_LIMIT_EXCEEDED',
}

// Clients already read these codes from the `error` field
const LEGACY_ERROR_FIELD_CODES = new Set<PaymentRequiredErrorCode>([
  PaymentRequiredErrorCode.FileUploadSizeExceeded,
]);

export class PaymentRequiredException extends HttpException {
  constructor(
    message?: string,
    errorCode: PaymentRequiredErrorCode = PaymentRequiredErrorCode.FeatureNotInPlan,
  ) {
    super(
      {
        message:
          message ??
          'It seems you reached the limit or feature is not available for your current plan tier',
        ...(LEGACY_ERROR_FIELD_CODES.has(errorCode)
          ? { error: errorCode }
          : {}),
        errorCode,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
