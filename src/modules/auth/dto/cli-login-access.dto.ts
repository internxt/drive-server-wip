import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { IsEncryptedPassword } from '../../../externals/crypto/decorators/password-dto.validators';
import { IsOpenPgpPublicKey } from '../../../externals/asymmetric-encryption/decorators/openpgp-public-key.validator';
import { IsKyberPublicKey } from '../../../externals/asymmetric-encryption/decorators/kyber-public-key.validator';
import { IsEncryptedKeyOfSize } from '../../../externals/asymmetric-encryption/decorators/encrypted-key.validator';
import { KYBER512_PRIVATE_KEY_BASE64_BYTES } from '../../keyserver/dto/keys.dto';

class CliEccKeysDto {
  @IsString()
  @IsNotEmpty()
  @IsOpenPgpPublicKey()
  @ApiProperty({ example: 'publicKeyExample', required: false })
  publicKey: string;

  @IsString()
  @IsNotEmpty()
  @IsEncryptedKeyOfSize()
  @ApiProperty({ example: 'privateKeyExample', required: false })
  privateKey: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'revocationKeyExample', required: false })
  revocationKey?: string;
}

class CliKeysDto {
  @IsOptional()
  @Type(() => CliEccKeysDto)
  @ValidateNested()
  @ApiProperty({ type: CliEccKeysDto, required: false })
  ecc?: CliEccKeysDto;
}

export class CliLoginAccessDto {
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
  @IsEncryptedPassword()
  password: string;

  @ApiProperty({
    example: 'two_factor_authentication_code',
    description: 'TFA',
    required: false,
  })
  @IsOptional()
  @IsString()
  tfa?: string;

  @Type(() => CliKeysDto)
  @IsOptional()
  @ValidateNested()
  @ApiProperty({
    type: CliKeysDto,
    description: 'keys',
    required: false,
  })
  keys?: CliKeysDto;
}
