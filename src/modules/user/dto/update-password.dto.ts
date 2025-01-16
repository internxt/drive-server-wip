import { ApiProperty, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BaseKeysDto } from '../../keyserver/dto/keys.dto';

class PrivateKeysDto extends PickType(BaseKeysDto, ['privateKey']) {}

class KeysDto {
  @ValidateNested()
  @Type(() => PrivateKeysDto)
  @IsNotEmpty()
  @ApiProperty({
    type: PrivateKeysDto,
    description: 'ECC keys',
  })
  ecc: PrivateKeysDto;

  @ValidateNested()
  @Type(() => PrivateKeysDto)
  @IsNotEmpty()
  @ApiProperty({
    type: PrivateKeysDto,
    description: 'Kyber keys',
  })
  kyber: PrivateKeysDto;
}

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

  @ValidateIf((dto) => !dto.keys)
  @IsNotEmpty({
    message: 'PrivateKey must be defined if keys object is not provided.',
  })
  @IsString()
  @ApiProperty({
    example: 'newPrivateKey',
    description: 'New private key',
    deprecated: true,
  })
  privateKey: string;

  @ValidateIf((dto) => !dto.keys)
  @IsNotEmpty({
    message: 'EncryptVersion must be defined if keys object is not provided.',
  })
  @IsString()
  @ApiProperty({
    example: 'encryptVersion',
    description: 'Encrypt version',
    deprecated: true,
  })
  encryptVersion: string;

  @ValidateIf((dto) => !dto.privateKey && !dto.encryptVersion)
  @IsNotEmpty({
    message:
      'Keys object must be provided if privateKey and encryptVersion are not defined.',
  })
  @ValidateNested()
  @Type(() => KeysDto)
  @IsObject()
  @ApiProperty({
    type: KeysDto,
    description:
      'Keys, if provided, will update the user keys. This object replaces the need for privateKey and encryptVersion.',
  })
  keys?: KeysDto;
}
