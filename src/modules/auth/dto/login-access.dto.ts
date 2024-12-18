import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginAccessDto {
  @ApiProperty({
    example: 'user@internxt.com',
    description: 'The email of the user',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'some_hashed_pass',
    description: 'User password',
  })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({
    example: 'two_factor_authentication_code',
    description: 'TFA',
  })
  @IsString()
  tfa: string;

  @ApiProperty({
    example: 'public_key',
    description: 'Public Key',
  })
  @IsNotEmpty()
  @IsString()
  publicKey: string; //TODO: Check this field. It's possible that we need an Object Keys

  @ApiProperty({
    example: 'private_key',
    description: 'Private Key',
  })
  @IsNotEmpty()
  @IsString()
  privateKey: string; //TODO: Check this field. It's possible that we need an Object Keys

  @ApiProperty({
    example: 'revocate_key',
    description: 'Revocate Key',
  })
  @IsNotEmpty()
  @IsString()
  revocateKey: string; //TODO: Check this field. It's possible that we need an Object Keys
}
