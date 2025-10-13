import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { SortOrder } from '../../../common/order.type';
import { SortableFolderAttributes } from '../folder.domain';

export class GetFoldersInFoldersDto {
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
    enum: ['updatedAt', 'id', 'plainName', 'name'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['updatedAt', 'id', 'plainName', 'name'])
  sort?: SortableFolderAttributes;

  @ApiProperty({
    description: 'Sort order',
    enum: SortOrder,
    required: false,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
