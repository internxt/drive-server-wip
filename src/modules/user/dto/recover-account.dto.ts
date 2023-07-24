import { ApiProperty } from '@nestjs/swagger';

export class RecoverAccountDto {
  @ApiProperty({
    example: 'some_hashed_pass',
    description: 'New user pass hashed',
  })
  password: string;

  @ApiProperty({
    example: 'some_salt',
    description: 'Hashed password salt',
  })
  salt: string;

  @ApiProperty({
    example: 'some_encrypted_mnemonic',
    description: 'User mnemonic encrypted with the new pass',
  })
  mnemonic: string;
}

export class RequestRecoverAccountDto {
  @ApiProperty({
    example: 'hello@internxt.com',
    description: 'User email',
  })
  email: string;
}
