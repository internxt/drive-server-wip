import { ApiProperty } from '@nestjs/swagger';

export class GetUserUsageDto {
  @ApiProperty()
  drive: number;

  @ApiProperty()
  backup: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Mail storage charged to the shared plan counter, in bytes. Null when the mail service could not be reached and no cached value is available; clients should show the total as unavailable rather than treating it as zero.',
  })
  mail: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Sum of drive, backup and mail usage. Null whenever mail usage is null, since a total that omits mail understates the space the user is gated on.',
  })
  total: number | null;
}
