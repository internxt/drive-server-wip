import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

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
}

export class RequestRecoverAccountDto {
  @ApiProperty({
    example: 'hello@internxt.com',
    description: 'User email',
  })
  email: string;
}
