import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsEncryptedMnemonic } from '../../../externals/crypto/decorators/is-encrypted-mnemonic.decorator';
import { IsArgon2Hash, IsSalt } from '../../../externals/crypto/decorators/password-dto.validators';
import { IsEncryptedKeyOfSize } from '../../../externals/asymmetric-encryption/decorators/encrypted-key.validator';
import { KYBER512_PRIVATE_KEY_BASE64_BYTES } from '../../keyserver/dto/keys.dto';

export class UpdatePasswordV2Dto {
  @IsArgon2Hash()
  @ApiProperty({
    example: 'argon2id_hash',
    description: 'Argon2id hash of the current password',
  })
  currentPasswordHash: string;

  @IsArgon2Hash()
  @ApiProperty({
    example: 'argon2id_hash',
    description: 'Argon2id hash of the new password',
  })
  newPasswordHash: string;

  @IsNotEmpty()
  @IsSalt()
  @ApiProperty({
    example: 'newSalt',
    description: 'New argon2id salt',
  })
  newSalt: string;

  @ApiProperty({
    example: 'newMnemonic',
    description: 'New mnemonic',
  })
  @IsNotEmpty()
  @IsEncryptedMnemonic()
  encryptedMnemonic: string;

  @IsString()
  @MaxLength(3200)
  @IsEncryptedKeyOfSize()
  @ApiProperty({
    example: 'encryptedPrivateKey',
    description: 'Ecc private key encrypted with new password',
  })
  encryptedPrivateKey: string;

  @IsString()
  @MaxLength(3200)
  @IsEncryptedKeyOfSize(KYBER512_PRIVATE_KEY_BASE64_BYTES)
  @ApiProperty({
    example: 'encryptedPrivateKey',
    description: 'Kyber private key encrypted with new password',
  })
  encryptedPrivateKyberKey: string;
}