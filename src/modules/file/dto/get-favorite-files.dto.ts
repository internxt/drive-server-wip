import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { type SortableFileAttributes } from '../file.domain';
import { SortOrder } from '../../../common/order.type';
import { RequiredLargePaginationDto } from '../../../common/dto/basic-pagination.dto';

export class GetFavoriteFilesDto extends RequiredLargePaginationDto {
  @ApiProperty({
    description: 'Field to sort by',
    enum: ['updatedAt', 'uuid'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['updatedAt', 'uuid'])
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
    description: 'Filter favorite files updated after this date',
    required: false,
  })
  @IsOptional()
  @IsString()
  updatedAt?: string;
}
