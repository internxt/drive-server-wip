import { IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateShareDto {
  @ApiProperty({
    example: '4',
    description: 'Times to view valid, set null if unlimited',
  })
  timesValid: number | null;

  @ApiProperty({
    example: 'token',
    description: 'Encryption key',
  })
  encryptionKey = '';

  @ApiProperty({
    example: 'mnemonic mnemonic',
    description: 'Mnemonic',
  })
  encryptedMnemonic: string;

  @IsNotEmpty()
  @ApiProperty({
    example: 'token',
    description: 'Token of item',
  })
  itemToken: string;

  @ApiProperty({
    example: 'bucketToken',
    description: 'Token of Bucket',
  })
  bucket: string;

  @IsNotEmpty()
  @IsOptional()
  @ApiProperty({
    example: 'a_sample_password_here',
    description: 'Password to protect the shared resoruce',
  })
  plainPassword?: string | null;

  @ApiProperty({
    example: 'code',
    description: 'Code Encrypted',
  })
  encryptedCode: string;
}
