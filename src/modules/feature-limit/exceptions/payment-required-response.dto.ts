import { ApiProperty } from '@nestjs/swagger';
import { PaymentRequiredErrorCode } from './payment-required.exception';

export class PaymentRequiredResponseDto {
  @ApiProperty({
    example: 'File size exceeds the maximum allowed by your plan',
  })
  message: string;

  @ApiProperty({ enum: PaymentRequiredErrorCode })
  errorCode: PaymentRequiredErrorCode;

  @ApiProperty({
    enum: [PaymentRequiredErrorCode.FileUploadSizeExceeded],
    required: false,
    description:
      'Legacy field, only present for FILE_UPLOAD_SIZE_EXCEEDED. Use errorCode instead',
  })
  error?: PaymentRequiredErrorCode;
}
