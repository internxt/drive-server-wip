import { ApiProperty } from '@nestjs/swagger';

class PublicAndPrivateKeyDto {
  @ApiProperty()
  publicKey: string;

  @ApiProperty()
  privateKey: string;
}

class UserKeysDto {
  @ApiProperty()
  ecc: PublicAndPrivateKeyDto;

  @ApiProperty()
  kyber: PublicAndPrivateKeyDto;
}

export class UserDto {
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
  privateKey: string;

  @ApiProperty()
  publicKey: string;

  @ApiProperty()
  revocateKey: string;

  @ApiProperty()
  keys: UserKeysDto;

  @ApiProperty()
  bucket: string;

  @ApiProperty()
  registerCompleted: boolean;

  @ApiProperty()
  teams: boolean;

  @ApiProperty()
  username: string;

  @ApiProperty()
  bridgeUser: string;

  @ApiProperty()
  sharedWorkspace: boolean;

  @ApiProperty()
  hasReferralsProgram: boolean;

  @ApiProperty()
  backupsBucket: string;

  @ApiProperty()
  avatar: string;

  @ApiProperty()
  emailVerified: boolean;

  @ApiProperty()
  lastPasswordChangedAt: Date;
}
