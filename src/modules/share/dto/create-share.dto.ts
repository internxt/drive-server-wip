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
    example:
      '53616c7465645f5fba6e8c807dace724e060ed51138e87c7789c145e6cdc3d45c5a0197efc1d7d326d48454e960747f1e48b8c2477c20b94ff64e66dfabb79553ec8b46cb66be52f98b8caff78d3893e059370a3dfcd7ff876b659f7578b6a3e',
    description: 'Encryped password to protect the shared resoruce',
  })
  encryptedPassword?: string | null;

  @ApiProperty({
    example: 'code',
    description: 'Code Encrypted',
  })
  encryptedCode: string;
}
