import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendAccountSetupEmailDto {
  @ApiProperty({
    example: 'hello@internxt.com',
    description: 'Email used to pay for the account',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
