import { IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserAttributes } from '../user.domain';

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
  @ApiProperty({
    example: '',
    description: '',
  })
  privateKey: string;

  @IsOptional()
  @ApiProperty({
    example: '',
    description: '',
  })
  publicKey: string;

  @IsOptional()
  @ApiProperty({
    example: '',
    description: '',
  })
  revocationKey: string;

  @IsOptional()
  @ApiProperty({
    example: '',
    description: '',
  })
  referrer: UserAttributes['referrer'];
}
