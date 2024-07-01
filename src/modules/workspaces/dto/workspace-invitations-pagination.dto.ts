import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';

export class WorkspaceInvitationsPagination {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  @ApiProperty({
    example: 1,
    description: 'Number of items to request',
    required: true,
    type: Number,
  })
  limit: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @ApiProperty({
    example: 0,
    description: 'Number of items to skip',
    required: true,
    type: Number,
  })
  offset: number;
}
