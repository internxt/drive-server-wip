import { HttpStatus } from '@nestjs/common';
import {
  PaymentRequiredErrorCode,
  PaymentRequiredException,
} from './payment-required.exception';

describe('PaymentRequiredException', () => {
  it('When created with a message and a code, then it responds 402 with the message and the error code', () => {
    const exception = new PaymentRequiredException(
      'Referral access not allowed for this user tier',
      PaymentRequiredErrorCode.FeatureNotInPlan,
    );

    const response = exception.getResponse();

    expect(exception.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
    expect(response).toEqual({
      message: 'Referral access not allowed for this user tier',
      errorCode: PaymentRequiredErrorCode.FeatureNotInPlan,
    });
  });

  it('When created without a message or code, then it uses the default message and the feature not in plan code', () => {
    const exception = new PaymentRequiredException();

    const response = exception.getResponse();

    expect(response).toEqual({
      message:
        'It seems you reached the limit or feature is not available for your current plan tier',
      errorCode: PaymentRequiredErrorCode.FeatureNotInPlan,
    });
  });

  it('When the upload size is exceeded, then it keeps the legacy error field next to the error code', () => {
    const exception = new PaymentRequiredException(
      'File size exceeds the maximum allowed by your plan',
      PaymentRequiredErrorCode.FileUploadSizeExceeded,
    );

    const response = exception.getResponse();

    expect(response).toEqual({
      message: 'File size exceeds the maximum allowed by your plan',
      error: PaymentRequiredErrorCode.FileUploadSizeExceeded,
      errorCode: PaymentRequiredErrorCode.FileUploadSizeExceeded,
    });
  });
});
