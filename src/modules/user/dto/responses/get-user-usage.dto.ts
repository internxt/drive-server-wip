import { ApiProperty } from '@nestjs/swagger';

export class GetUserUsageDto {
  @ApiProperty()
  drive: number;
}
