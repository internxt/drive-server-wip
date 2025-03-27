import { ApiProperty } from '@nestjs/swagger';

export class GetUserLimitDto {
  @ApiProperty()
  maxSpaceBytes: number;
}
