import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class IncompleteCheckoutDto {
  @ApiProperty({
    description: 'URL to complete the checkout process',
    example: 'https://drive.internxt.com/checkout/complete',
  })
  @IsUrl()
  completeCheckoutUrl: string;
}
