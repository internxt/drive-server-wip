import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsEncryptedMnemonic } from '../../../externals/crypto/decorators/is-encrypted-mnemonic.decorator';
import {
  IsEncryptedPassword,
  IsEncryptedSalt,
} from '../../../externals/crypto/decorators/password-dto.validators';
import { IsEncryptedKeyOfSize } from '../../../externals/asymmetric-encryption/decorators/encrypted-key.validator';
import { KYBER512_PRIVATE_KEY_BASE64_BYTES } from '../../keyserver/dto/keys.dto';

export class UpdatePasswordDto {
  @IsEncryptedPassword()
  @ApiProperty({
    example: 'currentPassword',
    description: 'Current password',
  })
  currentPassword: string;

  @IsEncryptedPassword()
  @ApiProperty({
    example: 'newPassword',
    description: 'New password',
  })
  newPassword: string;

  @IsEncryptedSalt()
  @ApiProperty({
    example: 'newSalt',
    description: 'New salt',
  })
  newSalt: string;

  @ApiProperty({
    example: 'newMnemonic',
    description: 'New mnemonic',
  })
  @IsNotEmpty()
  @IsEncryptedMnemonic()
  mnemonic: string;

  @IsString()
  @MaxLength(3200)
  @IsEncryptedKeyOfSize()
  @ApiProperty({
    example: 'encryptedPrivateKey',
    description: 'Ecc private key encrypted with new password',
  })
  privateKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(3200)
  @IsEncryptedKeyOfSize(KYBER512_PRIVATE_KEY_BASE64_BYTES)
  @ApiProperty({
    example: 'encryptedPrivateKey',
    description: 'Kyber private key encrypted with new password',
  })
  privateKyberKey?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: 'encryptVersion',
    description: 'Encrypt version',
    deprecated: true,
  })
  encryptVersion?: string;
}
