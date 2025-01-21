import { ApiProperty, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, ValidateNested } from 'class-validator';

export class BaseKeysDto {
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

export class KyberKeysDto extends PickType(BaseKeysDto, [
  'publicKey',
  'privateKey',
] as const) {}

export class EccKeysDto extends BaseKeysDto {}

export class KeysDto {
  @Type(() => EccKeysDto)
  @ValidateNested()
  @ApiProperty({
    type: EccKeysDto,
    description: 'ECC keys',
  })
  ecc: EccKeysDto;

  @Type(() => KyberKeysDto)
  @ValidateNested()
  @ApiProperty({
    type: KyberKeysDto,
    description: 'Kyber keys',
  })
  kyber: KyberKeysDto;
}
