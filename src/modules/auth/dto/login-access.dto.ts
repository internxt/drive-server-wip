import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { KeysDto } from '../../keyserver/dto/keys.dto';

class OptionalKeyGroup extends PartialType(KeysDto) {}

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
    description: 'Public Key (deprecated in favor of keys object)',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  publicKey?: string;

  @ApiProperty({
    example: 'private_key',
    description: 'Private Key (deprecated in favor of keys object)',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  privateKey?: string;

  @ApiProperty({
    example: 'revocate_key',
    description: 'Revocate Key (deprecated in favor of keys object)',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  revocateKey?: string;

  @ApiProperty({
    example: 'revocation_key',
    description: 'Revocation Key (deprecated in favor of keys object)',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  revocationKey?: string;

  @Type(() => OptionalKeyGroup)
  @IsOptional()
  @ValidateNested()
  @ApiProperty({
    example: 'newKeys',
    description: 'keys',
  })
  keys?: OptionalKeyGroup;
}
