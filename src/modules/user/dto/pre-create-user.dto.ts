import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { type UserAttributes } from '../user.attributes';

export class PreCreateUserDto {
  @IsNotEmpty()
  @IsEmail()
  @ApiProperty({
    example: 'myaccount@internxt.com',
    description: 'Email of the new account',
  })
  email: UserAttributes['email'];
}
