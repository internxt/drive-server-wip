import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { FileStatus } from '../file.domain';

const allowedStatuses = [...Object.values(FileStatus), 'ALL'];

export class GetFilesSyncDto {
  @ApiProperty({
    description: 'File status filter',
    enum: allowedStatuses,
    required: true,
  })
  @IsEnum(allowedStatuses)
  status: FileStatus | 'ALL';

  @ApiProperty({
    description:
      'Filter files updated after this date. Required if cursor is not provided',
    required: false,
  })
  @ValidateIf((dto) => !dto.cursor)
  @IsISO8601(
    { strict: true },
    { message: 'updatedAt must be a valid ISO8601 date' },
  )
  updatedAt?: string;

  @ApiProperty({
    description: 'Cursor token to fetch the next page of results',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  cursor?: string;

  @ApiProperty({
    description: 'Page size, max 1000',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
