import { ApiProperty } from '@nestjs/swagger';

export class GetUserUsageDto {
  @ApiProperty()
  drive: number;

  @ApiProperty()
  backup: number;

  @ApiProperty({
    type: Number,
    description:
      'Mail storage charged to the shared plan counter, in bytes. Falls back to the last known cached value, or 0 if none is available, when the mail service cannot be reached.',
  })
  mail: number;

  @ApiProperty({
    type: Number,
    description: 'Sum of drive, backup and mail usage.',
  })
  total: number;
}
