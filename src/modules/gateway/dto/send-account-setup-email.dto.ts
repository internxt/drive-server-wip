import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SendAccountSetupEmailDto {
  @ApiProperty({
    example: 'Premium',
    description: 'Name of the purchased plan, shown in the account setup email',
  })
  @IsString()
  @IsOptional()
  planName?: string;
}
