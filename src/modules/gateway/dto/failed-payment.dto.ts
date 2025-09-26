import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class FailedPaymentDto {
  @ApiProperty({
    description: 'Email address of the user who had a failed payment',
    example: 'user@internxt.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
