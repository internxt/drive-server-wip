import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class EncryptedMnemonicDto {
  @ApiProperty({
    example: 'mnemonic_encrypted_with_ecc_method',
    description: 'Mnemonic encrypted with ECC method',
  })
  @IsNotEmpty()
  ecc: string;

  @ApiProperty({
    example: 'mnemonic_encrypted_with_hybrid_method',
    description: 'Mnemonic encrypted with hybrid method',
  })
  @IsNotEmpty()
  hybrid: string;
}

class RecoverAccountKeysPairDto {
  @ApiProperty({
    example: 'public_key',
    description: 'public key',
  })
  @IsNotEmpty()
  public: string;

  @ApiProperty({
    example: 'private_key',
    description: 'private key encrypted with password',
  })
  @IsNotEmpty()
  private: string;
}

class RecoverAccountEccKeysDto extends RecoverAccountKeysPairDto {
  @ApiProperty({
    example: 'revocation_key',
    description: 'Key used for revocation',
  })
  @IsNotEmpty()
  revocationKey: string;
}

class NewGeneratedKeysDto {
  @ApiProperty({
    type: RecoverAccountEccKeysDto,
    description: 'ECC keys (public and private)',
  })
  @ValidateNested()
  @Type(() => RecoverAccountEccKeysDto)
  ecc: RecoverAccountEccKeysDto;

  @ApiProperty({
    type: RecoverAccountKeysPairDto,
    description: 'Kyber keys (public and private)',
  })
  @ValidateNested()
  @Type(() => RecoverAccountKeysPairDto)
  kyber: RecoverAccountKeysPairDto;
}

export class LegacyRecoverAccountDto {
  @ApiProperty({
    example: 'temporary_auth_token',
    description: 'Base64 encoded temporary auth token',
  })
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: 'hashed_password',
    description: 'New user pass hashed',
  })
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    example: 'password_salt',
    description: 'Hashed password salt',
  })
  @IsNotEmpty()
  salt: string;

  @ApiProperty({
    example: 'password_encrypted_mnemonic',
    description: 'User mnemonic encrypted with the new pass',
  })
  @IsNotEmpty()
  mnemonic: string;

  @ApiProperty({
    type: EncryptedMnemonicDto,
    description: 'Mnemonic encrypted with asymmetric encryption algorithms',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => EncryptedMnemonicDto)
  asymmetricEncryptedMnemonic: EncryptedMnemonicDto;

  @ApiProperty({
    type: NewGeneratedKeysDto,
    description: 'User ecc and kyber keys',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => NewGeneratedKeysDto)
  keys: NewGeneratedKeysDto;
}
