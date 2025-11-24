import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUrl, IsOptional, IsString, IsNumber } from 'class-validator';

export class IncompleteCheckoutDto {
  @ApiProperty({
    description: 'URL to complete the checkout process',
    example: 'https://drive.internxt.com/checkout/complete',
  })
  @IsUrl()
  completeCheckoutUrl: string;

  @ApiPropertyOptional({
    description: 'Name of the plan being purchased',
    example: 'Premium',
  })
  @IsOptional()
  @IsString()
  planName?: string;

  @ApiPropertyOptional({
    description: 'Price of the plan in euros',
    example: 320.0,
  })
  @IsOptional()
  @IsNumber()
  price?: number;
}
