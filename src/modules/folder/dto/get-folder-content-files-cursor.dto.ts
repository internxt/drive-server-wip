import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SortOrder } from '../../../common/order.type';

export class GetFolderContentFilesCursorDto {
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

  @ApiProperty({
    description: 'Whether to include each file favorite status',
    default: false,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  withFavorites?: boolean;

  @ApiProperty({
    description: 'Whether to include each file thumbnails',
    default: false,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  withThumbnails?: boolean;

  @ApiProperty({
    description: 'Whether to include each file sharing info',
    default: false,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  withSharings?: boolean;
}

export class FolderFilesCursorDto {
  @IsUUID()
  lastUuid: string;

  @IsEnum(SortOrder)
  order: SortOrder;

  @IsString()
  lastValue: string;
}
