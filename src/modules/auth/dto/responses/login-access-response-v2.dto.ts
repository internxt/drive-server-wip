import { ApiProperty } from '@nestjs/swagger';
import { UserV2Dto } from './user-v2.dto';

export class LoginAccessResponseV2Dto {
  @ApiProperty({ type: UserV2Dto })
  user: UserV2Dto;

  @ApiProperty()
  token: string;

}
