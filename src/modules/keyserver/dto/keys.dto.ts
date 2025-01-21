import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  ValidateNested,
  IsOptional,
} from 'class-validator';

export class KyberKeysDto {
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
}

export class EccKeysDto {
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
  //@Type(() => KyberKeysDto)
  //@ValidateNested()
  @ApiProperty({
    type: KyberKeysDto,
    description: 'Kyber keys',
  })
  kyber: KyberKeysDto;
}
