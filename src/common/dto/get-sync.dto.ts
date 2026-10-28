import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const SYNC_MAX_LIMIT = 250;

export abstract class GetSyncDto {
  @ApiProperty({
    description:
      'Filter items updated after this date. Required if cursor is not provided',
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
    description:
      'Page size, max 250. Values up to 1000 are still accepted for backward compatibility but capped to 250; they will be rejected in the future',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
