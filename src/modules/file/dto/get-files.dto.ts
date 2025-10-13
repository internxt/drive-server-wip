import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { SortableFileAttributes } from '../file.domain';
import { SortOrder } from '../../../common/order.type';
import { FileStatusQuery } from '../../../common/enums/file-status-query.enum';

export class GetFilesDto {
  @ApiProperty({
    description: 'Number of items per page',
    example: 50,
    required: true,
    minimum: 1,
    maximum: 1000,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit: number;

  @ApiProperty({
    description: 'Offset for pagination',
    example: 0,
    required: true,
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset: number;

  @ApiProperty({
    description: 'File status filter',
    enum: FileStatusQuery,
    required: true,
  })
  @IsEnum(FileStatusQuery)
  status: FileStatusQuery;

  @ApiProperty({
    description: 'Bucket ID filter',
    required: false,
  })
  @IsOptional()
  @IsString()
  bucket?: string;

  @ApiProperty({
    description: 'Field to sort by',
    enum: ['updatedAt', 'size', 'id', 'plainName', 'name'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['updatedAt', 'size', 'id', 'plainName', 'name'])
  sort?: SortableFileAttributes;

  @ApiProperty({
    description: 'Sort order',
    enum: SortOrder,
    required: false,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;

  @ApiProperty({
    description: 'Filter files updated after this date',
    required: false,
  })
  @IsOptional()
  @IsString()
  updatedAt?: string;
}
