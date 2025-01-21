import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
  @IsOptional()
  @IsString()
  tfa?: string;

  @ApiProperty({
    example: 'public_key',
    description: 'Public Key',
  })
  @IsOptional()
  @IsString()
  publicKey?: string;

  @ApiProperty({
    example: 'private_key',
    description: 'Private Key',
  })
  @IsOptional()
  @IsString()
  privateKey?: string;

  @ApiProperty({
    example: 'revocate_key',
    description: 'Revocate Key',
  })
  @IsOptional()
  @IsString()
  revocateKey?: string;
}
