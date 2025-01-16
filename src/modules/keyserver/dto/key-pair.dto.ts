import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class KeyPairDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'publicKeyExample',
    description: 'Public key',
  })
  publicKey: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'privateKeyExample',
    description: 'Private key',
  })
  privateKey: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'revocationKeyExample',
    description: 'Revocation key',
  })
  revocationKey: string;
}

export class KyberKeysDto extends PickType(KeyPairDto, [
  'publicKey',
  'privateKey',
] as const) {}

export class EccKeysDto extends KeyPairDto {}
