import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePasswordDto {
  @IsString()
  @ApiProperty({
    example: 'currentPassword',
    description: 'Current password',
  })
  currentPassword: string;

  @IsString()
  @ApiProperty({
    example: 'newPassword',
    description: 'New password',
  })
  newPassword: string;

  @IsString()
  @ApiProperty({
    example: 'newSalt',
    description: 'New salt',
  })
  newSalt: string;

  @IsString()
  @ApiProperty({
    example: 'newMnemonic',
    description: 'New mnemonic',
  })
  mnemonic: string;

  @IsString()
  @MaxLength(3200)
  @ApiProperty({
    example: 'encryptedPrivateKey',
    description: 'Ecc private key encrypted with new password',
  })
  privateKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(3200)
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

class KeyPair {
  @IsString()
  publicKey: string;

  @IsString()
  privateKey: string;
}

export class UserKeysDto {
  @ValidateNested()
  @Type(() => KeyPair)
  @ApiProperty({
    type: KeyPair,
    description: 'ECC key pair',
  })
  ecc: KeyPair;

  @ValidateNested()
  @Type(() => KeyPair)
  @ApiProperty({
    type: KeyPair,
    description: 'Kyber key pair',
  })
  kyber: KeyPair;
}

export class UpdatePasswordOpaqueStartDto {
  @IsString()
  @ApiProperty({
    example: 'hmac',
    description: 'Hashed hmac to authenticate the request',
  })
  hmac: string;

  @IsString()
  @ApiProperty({
    example: 'sessionID',
    description: 'ID of the session',
  })
  sessionID: string;

  @IsString()
  @ApiProperty({
    example: 'registrationRequest',
    description: 'Opaque registration request',
  })
  registrationRequest: string;
}

export class UpdatePasswordOpaqueFinishDto {
  @IsString()
  @ApiProperty({
    example: 'hmac',
    description: 'Hashed hmac to authenticate the request',
  })
  hmac: string;

  @IsString()
  @ApiProperty({
    example: 'sessionID',
    description: 'ID of the session',
  })
  sessionID: string;

  @ValidateNested()
  @Type(() => UserKeysDto)
  @ApiProperty({
    type: UserKeysDto,
    description: 'Encrypted keys of the user',
    example: {
      ecc: {
        publicKey: 'eccPublicKeyString',
        privateKey: 'eccPrivateKeyString',
      },
      kyber: {
        publicKey: 'kyberPublicKeyString',
        privateKey: 'kyberPrivateKeyString',
      },
    },
  })
  keys: UserKeysDto;

  @IsString()
  @ApiProperty({
    example: 'mnemonic',
    description: 'encrypted mnemonic of the user',
  })
  mnemonic: string;

  @IsString()
  @ApiProperty({
    example: 'registrationRecord',
    description: 'Opaque registration record',
  })
  registrationRecord: string;

  @IsString()
  @ApiProperty({
    example: 'startLoginRequest',
    description: 'Opaque start login request',
  })
  startLoginRequest: string;
}
