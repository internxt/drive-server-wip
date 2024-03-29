import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

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
  @ApiProperty({
    example: 'newPrivateKey',
    description: 'New private key',
  })
  privateKey: string;

  @IsString()
  @ApiProperty({
    example: 'encryptVersion',
    description: 'Encrypt version',
  })
  encryptVersion: string;
}
