import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from './user.dto';

export class LoginAccessResponseV2Dto {
  @ApiProperty({ type: UserDto })
  user: UserDto;

  @ApiProperty()
  token: string;

}
