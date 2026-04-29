import { ApiProperty } from '@nestjs/swagger';
import { PaymentRequiredErrorCode } from './payment-required.exception';

export class PaymentRequiredResponseDto {
  @ApiProperty({
    example: 'File size exceeds the maximum allowed by your plan',
  })
  message: string;

  @ApiProperty({ enum: PaymentRequiredErrorCode })
  error: PaymentRequiredErrorCode;
}
