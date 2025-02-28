import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from './user.dto';

export class LoginResponseDto {
  @ApiProperty({ type: UserDto })
  user: UserDto;
  @ApiProperty()
  token: string;
  @ApiProperty()
  userTeam: any;
  @ApiProperty()
  newToken: string;
}
