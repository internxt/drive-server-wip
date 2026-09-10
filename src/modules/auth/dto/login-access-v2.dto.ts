import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { IsArgon2Hash } from '../../../externals/crypto/decorators/password-dto.validators';


export class LoginAccessV2Dto {
  @ApiProperty({
    example: 'user@internxt.com',
    description: 'The email of the user',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

@ApiProperty({
    example: 'argon2id_hash',
    description: "Argon2id hash of the user's password",
  })
  @IsNotEmpty()
  @IsArgon2Hash()
  passwordHash: string;

  @ApiProperty({
    example: 'two_factor_authentication_code',
    description: 'TFA',
    required: false,
  })
  @IsOptional()
  @IsString()
  tfa?: string;

}
