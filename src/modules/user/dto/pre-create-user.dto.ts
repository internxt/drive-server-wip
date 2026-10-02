import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { type UserAttributes } from '../user.attributes';
import { PreCreatedUserStatus } from '../pre-created-users.attributes';

export class PreCreateUserDto {
  @IsNotEmpty()
  @IsEmail()
  @ApiProperty({
    example: 'myaccount@internxt.com',
    description: 'Email of the new account',
  })
  email: UserAttributes['email'];

  @IsOptional()
  @IsEnum(PreCreatedUserStatus)
  @ApiProperty({
    example: 'awaiting_payment',
    description: 'Status of the pre-created user',
  })
  status?: PreCreatedUserStatus;
}
