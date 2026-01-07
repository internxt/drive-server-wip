import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import {
  FileAttributes,
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

  @ApiProperty({
    description: 'Bucket ID filter',
    required: false,
  })
  @IsOptional()
  @IsString()
  bucket?: string;

  @ApiProperty({
    description: 'Field to sort by',
    enum: ['updatedAt', 'size', 'id', 'plainName', 'name', 'uuid'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['updatedAt', 'size', 'id', 'plainName', 'name', 'uuid'])
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

  @ApiProperty({
    description: 'The last file uuid of the provided list in the previous call',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  lastId?: FileAttributes['uuid'];
}
