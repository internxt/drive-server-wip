import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    example: 'token received',
    description: 'Token received in verification email',
  })
  @IsNotEmpty()
  @IsString()
  verificationToken: string;
}
