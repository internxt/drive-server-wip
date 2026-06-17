import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { IsOpenPgpPublicKey } from '../../../externals/asymmetric-encryption/decorators/openpgp-public-key.validator';
import { IsKyberPublicKey } from '../../../externals/asymmetric-encryption/decorators/kyber-public-key.validator';
import { IsEncryptedKeyOfSize } from '../../../externals/asymmetric-encryption/decorators/encrypted-key.validator';

// Kyber512 raw private key is 1632 bytes (confirmed via kem.privateKeyBytes from @dashlane/pqc-kem-kyber512-node)
// // aes.encrypt() is fed its base64 string (see getKeys() in the key-generation client),
// so the plaintext payload is Math.ceil(1632 / 3) * 4 = 2176 bytes.
const KYBER512_PRIVATE_KEY_BASE64_BYTES = 2176;

export class KyberKeysDto {
  @IsString()
  @IsNotEmpty()
  @IsKyberPublicKey()
  @ApiProperty({
    example: 'publicKeyExample',
    description: 'Public key',
  })
  publicKey: string;

  @IsString()
  @IsNotEmpty()
  @IsEncryptedKeyOfSize(KYBER512_PRIVATE_KEY_BASE64_BYTES)
  @ApiProperty({
    example: 'privateKeyExample',
    description: 'Private key',
  })
  privateKey: string;
}

export class EccKeysDto {
  @IsString()
  @IsNotEmpty()
  @IsOpenPgpPublicKey()
  @ApiProperty({
    example: 'publicKeyExample',
    description: 'Public key',
  })
  publicKey: string;

  @IsString()
  @IsNotEmpty()
  @IsEncryptedKeyOfSize()
  @ApiProperty({
    example: 'privateKeyExample',
    description: 'Private key',
  })
  privateKey: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    example: 'revocationKeyExample',
    description: 'Revocation key',
  })
  revocationKey?: string;
}

export class KeysDto {
  @Type(() => EccKeysDto)
  @ValidateNested()
  @ApiProperty({
    type: EccKeysDto,
    description: 'ECC keys',
  })
  ecc: EccKeysDto;

  // TODO: uncomment validations when frontend stops sending kyber object as {privateKey: null, publicKey: null}
  @Type(() => KyberKeysDto)
  @ValidateNested()
  @ApiProperty({
    type: KyberKeysDto,
    description: 'Kyber keys',
  })
  kyber: KyberKeysDto;
}
