import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  ValidateIf,
  type ValidationArguments,
} from 'class-validator';
import { SortOrder } from '../../../common/order.type';
import {
  FOLDER_STATUS_QUERY_VALUES,
  FolderStatusQuery,
  SortableFolderAttributes,
} from '../folder.domain';
import { RequiredLargePaginationDto } from '../../../common/dto/basic-pagination.dto';

export class GetFoldersQueryDto extends RequiredLargePaginationDto {
  @ApiProperty({
    description: 'Folder status filter',
    enum: FOLDER_STATUS_QUERY_VALUES,
    required: true,
  })
  @IsEnum(FOLDER_STATUS_QUERY_VALUES, {
    message: (args: ValidationArguments) =>
      `Unknown status "${args.value}". Allowed values are: ${FOLDER_STATUS_QUERY_VALUES.join(', ')}`,
  })
  status: FolderStatusQuery;

  @ApiProperty({
    description: 'Filter folders updated after this date',
    required: false,
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format for updatedAt' })
  updatedAt?: string;

  @ApiProperty({
    description: 'Field to sort by',
    enum: ['uuid', 'plainName', 'updatedAt'],
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => o.order !== undefined)
  @IsEnum(['uuid', 'plainName', 'updatedAt'])
  sort?: SortableFolderAttributes;

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
