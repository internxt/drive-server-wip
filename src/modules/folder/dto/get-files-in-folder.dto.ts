import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, ValidateIf } from 'class-validator';
import { SortableFileAttributes } from '../../file/file.domain';
import { SortOrder } from '../../../common/order.type';
import { RequiredPaginationDto } from '../../../common/dto/basic-pagination.dto';

export class GetFilesInFoldersDto extends RequiredPaginationDto {
  @ApiProperty({
    description: 'Field to sort by',
    enum: ['updatedAt', 'size', 'id', 'plainName', 'uuid'],
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => o.order !== undefined)
  @IsEnum(['updatedAt', 'size', 'id', 'plainName', 'uuid'])
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
