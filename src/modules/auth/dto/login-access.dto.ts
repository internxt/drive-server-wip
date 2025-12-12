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
    required: false,
  })
  @IsOptional()
  @IsString()
  tfa?: string;

  @ApiProperty({
    example: 'public_key',
    description: 'Public Key',
    deprecated: true,
    required: false,
  })
  @IsOptional()
  @IsString()
  publicKey?: string;

  @ApiProperty({
    example: 'private_key',
    description: 'Private Key',
    deprecated: true,
    required: false,
  })
  @IsOptional()
  @IsString()
  privateKey?: string;

  @ApiProperty({
    example: 'revocate_key',
    description: 'Revocate Key',
    deprecated: true,
    required: false,
  })
  @IsOptional()
  @IsString()
  revocateKey?: string;

  @Type(() => OptionalKeyGroup)
  @IsOptional()
  @ValidateNested()
  @ApiProperty({
    example: 'newKeys',
    description: 'keys',
    required: false,
  })
  keys?: OptionalKeyGroup;
}

export class LoginAccessOpaqueStartDto {
  @ApiProperty({
    example: 'user@internxt.com',
    description: 'The email of the user',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'startLoginRequest',
    description: 'The request to start opaque login',
  })
  @IsNotEmpty()
  startLoginRequest: string;
}

export class LoginAccessOpaqueFinishDto {
  @ApiProperty({
    example: 'user@internxt.com',
    description: 'The email of the user',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'finishLoginRequest',
    description: 'The request to finish opaque login',
  })
  @IsNotEmpty()
  finishLoginRequest: string;

  @ApiProperty({
    example: 'two_factor_authentication_code',
    description: 'TFA',
    required: false,
  })
  @IsOptional()
  @IsString()
  tfa?: string;
}
