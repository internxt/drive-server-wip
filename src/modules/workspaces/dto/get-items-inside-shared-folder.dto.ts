import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderBy } from '../../../common/order.type';

export class GetItemsInsideSharedFolderDtoQuery {
  @ApiPropertyOptional({
    description: 'Order by',
    example: 'name:asc',
  })
  @IsOptional()
  @IsString()
  orderBy?: OrderBy;

  @ApiPropertyOptional({
    description: 'Token',
  })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  page?: number = 0;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  perPage?: number = 50;
}
