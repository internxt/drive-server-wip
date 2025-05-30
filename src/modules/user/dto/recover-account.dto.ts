import { ApiProperty } from '@nestjs/swagger';
import {
  IsBooleanString,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';

class PrivateKeysDto {
  @ApiProperty()
  ecc: string;

  @ApiProperty()
  @IsOptional()
  kyber?: string;
}
export class RecoverAccountDto {
  @ApiProperty({
    example: 'some_hashed_pass',
    description: 'New user pass hashed',
  })
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    example: 'some_salt',
    description: 'Hashed password salt',
  })
  @IsNotEmpty()
  salt: string;

  @ApiProperty({
    example: 'some_encrypted_mnemonic',
    description: 'User mnemonic encrypted with the new pass',
  })
  @IsNotEmpty()
  mnemonic: string;

  @ApiProperty({
    example: {
      ecc: 'encrypted private key',
      kyber: 'encrypted kyber private key',
    },
    description: "User's private keys encrypted with the user's plain password",
  })
  @IsOptional()
  @ValidateNested()
  privateKeys?: PrivateKeysDto;
}

export class DeprecatedRecoverAccountDto {
  @ApiProperty({
    example: 'some_hashed_pass',
    description: 'New user pass hashed',
  })
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    example: 'some_salt',
    description: 'Hashed password salt',
  })
  @IsNotEmpty()
  salt: string;

  @ApiProperty({
    example: 'some_encrypted_mnemonic',
    description: 'User mnemonic encrypted with the new pass',
  })
  @IsNotEmpty()
  mnemonic: string;

  @ApiProperty({
    example: 'encrypted private key',
    description: "User's private key encrypted with the user's plain password",
  })
  @IsOptional()
  privateKey?: string;
}

export class RecoverAccountQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  token: string;

  @ApiProperty()
  @IsBooleanString()
  reset: string;
}

export class RequestRecoverAccountDto {
  @ApiProperty({
    example: 'hello@internxt.com',
    description: 'User email',
  })
  email: string;
}
