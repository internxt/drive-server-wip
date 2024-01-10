import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEmail } from 'class-validator';

export class RequestAccountUnblock {
  @ApiProperty({
    example: 'hello@internxt.com',
    description: 'User email',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
