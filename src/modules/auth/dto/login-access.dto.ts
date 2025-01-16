import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

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
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  publicKey?: string;

  @ApiProperty({
    example: 'private_key',
    description: 'Private Key',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  privateKey?: string;

  @ApiProperty({
    example: 'revocate_key',
    description: 'Revocate Key (deprecated field)',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  revocateKey?: string;

  @ApiProperty({
    example: 'revocation_key',
    description: 'Revocation Key',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value, obj }) => value ?? obj.revocateKey)
  revocationKey?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @ApiProperty({
    example: 'newKeys',
    description: 'keys',
  })
  keys?: {
    ecc?: {
      publicKey: string;
      privateKey: string;
      revocationKey: string;
    };
    kyber?: {
      publicKey: string;
      privateKey: string;
    };
  };
}
