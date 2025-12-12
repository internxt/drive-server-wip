import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from './user.dto';

export class LoginAccessResponseDto {
  @ApiProperty({ type: UserDto })
  user: UserDto;

  @ApiProperty()
  token: string;

  @ApiProperty()
  userTeam: any;

  @ApiProperty()
  newToken: string;
}

export class LoginAccessResponseOpaqueStartDto {
  @ApiProperty()
  loginResponse: string;
}

export class LoginAccessResponseOpaqueFinishDto {
  @ApiProperty({ type: UserDto })
  user: UserDto;

  @ApiProperty()
  token: string;

  @ApiProperty()
  sessionID: string;
}
