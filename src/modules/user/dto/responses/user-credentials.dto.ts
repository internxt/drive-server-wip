import { ApiProperty } from '@nestjs/swagger';
import { KeysDto } from '../../../../modules/keyserver/dto/keys.dto';

export class UserResponseDto {
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
  bucket: string;

  @ApiProperty()
  backupsBucket: string;

  @ApiProperty()
  avatar: string;

  @ApiProperty()
  emailVerified: boolean;

  @ApiProperty()
  sharedWorkspace: boolean;

  @ApiProperty({ deprecated: true })
  hasReferralsProgram: boolean;

  @ApiProperty({ deprecated: true })
  teams: boolean;

  @ApiProperty()
  lastPasswordChangedAt: Date;

  @ApiProperty()
  keys: KeysDto;

  @ApiProperty({ deprecated: true })
  privateKey: KeysDto['ecc']['privateKey'];

  @ApiProperty({ deprecated: true })
  publicKey: KeysDto['ecc']['publicKey'];

  @ApiProperty({ deprecated: true })
  revocateKey: KeysDto['ecc']['revocationKey'];
}

export class UserCredentialsDto {
  @ApiProperty({
    description: 'The old token that has been replaced',
    example: 'oldToken1234567890',
    deprecated: true,
    required: false,
  })
  token?: string;

  @ApiProperty({
    description: 'The old token that has been replaced',
    example: 'oldToken1234567890',
    deprecated: true,
    required: false,
  })
  oldToken?: string;

  @ApiProperty({
    description: 'The new token to be used for authentication',
    example: 'oldToken1234567890',
  })
  newToken: string;

  @ApiProperty({
    description: 'User information',
    type: UserResponseDto,
  })
  user: UserResponseDto;
}
