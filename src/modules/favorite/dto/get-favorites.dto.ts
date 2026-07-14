import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, ValidateIf } from 'class-validator';
import { SortOrder } from '../../../common/order.type';
import { FavoriteItemType } from '../favorite.domain';
import { RequiredLargePaginationDto } from '../../../common/dto/basic-pagination.dto';

const SORTABLE_FAVORITE_ATTRIBUTES = ['uuid', 'plainName', 'updatedAt'] as const;

export type SortableFavoriteAttributes =
  (typeof SORTABLE_FAVORITE_ATTRIBUTES)[number];

export class GetFavoritesDto extends RequiredLargePaginationDto {
  @ApiProperty({
    description: 'Type of favorite items to list',
    enum: FavoriteItemType,
    required: true,
  })
  @IsEnum(FavoriteItemType)
  type: FavoriteItemType;

  @ApiProperty({
    description: 'Field to sort by',
    enum: SORTABLE_FAVORITE_ATTRIBUTES,
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => o.order !== undefined)
  @IsEnum(SORTABLE_FAVORITE_ATTRIBUTES)
  sort?: SortableFavoriteAttributes;

  @ApiProperty({
    description: 'Sort order',
    enum: SortOrder,
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => o.sort !== undefined)
  @IsEnum(SortOrder, {
    message: 'Invalid order. Allowed values are: ASC, DESC',
  })
  order?: SortOrder;
}
