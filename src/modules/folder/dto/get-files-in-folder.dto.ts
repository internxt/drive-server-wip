import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { SortableFileAttributes } from '../../file/file.domain';
import { SortOrder } from '../../../common/order.type';

export class GetFilesInFoldersDto {
  @ApiProperty({
    description: 'Number of items per page',
    example: 50,
    required: true,
    minimum: 1,
    maximum: 50,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
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
}
