import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserAttributes } from '../user.attributes';

export class PreCreateUserDto {
  @IsNotEmpty()
  @ApiProperty({
    example: 'myaccount@internxt.com',
    description: 'Email of the new account',
  })
  email: UserAttributes['email'];
}
