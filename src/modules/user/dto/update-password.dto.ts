import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

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
