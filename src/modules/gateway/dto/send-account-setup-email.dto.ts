import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SendAccountSetupEmailDto {
  @ApiProperty({
    example: 'Premium',
    description: 'Name of the purchased plan, shown in the account setup email',
  })
  @IsString()
  @IsNotEmpty()
  planName: string;
}
