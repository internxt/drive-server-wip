import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SortOrder } from '../order.type';

export class CursorPaginationDto {
  @ApiProperty({
    description: 'Sort direction',
    enum: SortOrder,
    default: SortOrder.ASC,
    required: false,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  order: SortOrder = SortOrder.ASC;

  @ApiProperty({
    description: 'Cursor from a previous response to fetch the next page',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  cursor?: string;

  @ApiProperty({
    description: 'Page size',
    default: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(1000)
  limit: number = 100;
}

export class CursorPageTokenDto {
  @IsUUID()
  lastUuid: string;

  @IsEnum(SortOrder)
  order: SortOrder;

  @IsString()
  lastValue: string;
}
