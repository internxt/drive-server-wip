import { ApiProperty } from '@nestjs/swagger';

export class GetUserUsageDto {
  @ApiProperty()
  drive: number;

  @ApiProperty()
  backup: number;

  @ApiProperty()
  total: number;
}
