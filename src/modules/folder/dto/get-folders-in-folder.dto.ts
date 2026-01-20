import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, ValidateIf } from 'class-validator';
import { SortOrder } from '../../../common/order.type';
import { SortableFolderAttributes } from '../folder.domain';
import { RequiredPaginationDto } from '../../../common/dto/basic-pagination.dto';

export class GetFoldersInFoldersDto extends RequiredPaginationDto {
  @ApiProperty({
    description: 'Field to sort by',
    enum: ['updatedAt', 'id', 'plainName', 'uuid'],
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => o.order !== undefined)
  @IsEnum(['updatedAt', 'id', 'plainName', 'uuid'])
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
