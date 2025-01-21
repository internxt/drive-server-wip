import {
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserAttributes } from '../user.attributes';
import { Type } from 'class-transformer';
import { EccKeysDto, KyberKeysDto } from '../../keyserver/dto/keys.dto';

class KeysDto {
  @Type(() => EccKeysDto)
  @IsOptional()
  @ValidateNested()
  @ApiProperty({
    type: EccKeysDto,
    description: 'ECC keys',
  })
  ecc: EccKeysDto;

  @Type(() => KyberKeysDto)
  @IsOptional()
  @ValidateNested()
  @ApiProperty({
    type: KyberKeysDto,
    description: 'Kyber keys',
  })
  kyber: KyberKeysDto;
}

export class CreateUserDto {
  @IsNotEmpty()
  @ApiProperty({
    example: 'Internxt',
    description: 'Name of the new user',
  })
  name: UserAttributes['name'];

  @IsNotEmpty()
  @ApiProperty({
    example: 'Lastname',
    description: 'Last name of the new user',
  })
  lastname: UserAttributes['lastname'];

  @IsNotEmpty()
  @ApiProperty({
    example: 'myaccount@internxt.com',
    description: 'Email of the new account',
  })
  email: UserAttributes['email'];

  @IsNotEmpty()
  @ApiProperty({
    example: '$2a$08$4SN2l.8dM0fSUTzni3i61u047Sr/R3ocJYxbxmKdEmGJcVOj1sHIi',
    description: 'Hashed password',
  })
  password: UserAttributes['password'];

  @IsNotEmpty()
  @ApiProperty({
    example:
      'test test test test test test test test test test test test test test test test test test test test test test test test',
    description: 'The mnemonic used to derive encryption keys',
  })
  mnemonic: UserAttributes['mnemonic'];

  @IsNotEmpty()
  @ApiProperty({
    example: 'salt',
    description: 'Salt',
  })
  salt: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: '',
    description: '',
    deprecated: true,
  })
  privateKey?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: '',
    description: '',
    deprecated: true,
  })
  publicKey?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: '',
    description: '',
    deprecated: true,
  })
  revocationKey?: string;

  @IsOptional()
  @ApiProperty({
    example: '',
    description: '',
  })
  referrer?: UserAttributes['referrer'];

  @IsOptional()
  @ApiProperty({
    example: '',
    description: '',
  })
  registerCompleted?: UserAttributes['registerCompleted'];

  // TODO: uncomment object validations when frontend starts sending kyber.privateKey and kyber.publicKey with data instead of null;
  //@Type(() => KeysDto)
  @IsOptional()
  //@ValidateNested()
  @ApiProperty({
    type: KeysDto,
    description:
      'Keys, if provided, will update the user keys. This object replaces the need for privateKey and encryptVersion.',
  })
  keys?: KeysDto;
}
