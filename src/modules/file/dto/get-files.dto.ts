import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import {
  type FileAttributes,
  FileStatus,
  SortableFileAttributes,
} from '../file.domain';
import { SortOrder } from '../../../common/order.type';
import { RequiredLargePaginationDto } from '../../../common/dto/basic-pagination.dto';

const allowedStatuses = [...Object.values(FileStatus), 'ALL'];

export class GetFilesDto extends RequiredLargePaginationDto {
  @ApiProperty({
    description: 'File status filter',
    enum: allowedStatuses,
    required: true,
  })
  @IsEnum(allowedStatuses)
  status: FileStatus | 'ALL';

  // TODO: this should not be a valid option.
  @ApiProperty({
    description: 'Bucket ID filter',
    required: false,
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  bucket?: string;

  // TODO: uuid should not be a valid option here, but one client is using it so we need to keep it.
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
    description: 'Filter files updated after this date',
    required: false,
  })
  @IsOptional()
  @IsString()
  updatedAt?: string;
}
