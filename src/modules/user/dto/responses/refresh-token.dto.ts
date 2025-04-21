import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenUserResponseDto {
  @ApiProperty()
  email: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  mnemonic: string;

  @ApiProperty()
  root_folder_id: number;

  @ApiProperty()
  rootFolderId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  lastname: string;

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  credit: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  registerCompleted: boolean;

  @ApiProperty()
  username: string;

  @ApiProperty()
  bridgeUser: string;

  @ApiProperty()
  backupsBucket: string;

  @ApiProperty()
  avatar: string;

  @ApiProperty()
  emailVerified: boolean;

  @ApiProperty()
  lastPasswordChangedAt: Date;
}

export class RefreshTokenResponseDto {
  @ApiProperty({
    description: 'The old token that has been replaced',
    example: 'newToken1234567890',
  })
  token: string;

  @ApiProperty({
    description: 'The new token to be used for authentication',
    example: 'oldToken1234567890',
  })
  newToken: string;

  @ApiProperty({
    description: 'User information',
    type: RefreshTokenUserResponseDto,
  })
  user: RefreshTokenUserResponseDto;
}
