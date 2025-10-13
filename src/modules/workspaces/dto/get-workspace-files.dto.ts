import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { SortableFileAttributes } from '../../file/file.domain';
import { LargePaginationDto } from '../../../common/dto/basic-pagination.dto';
import { ApiProperty } from '@nestjs/swagger';
import { FileStatusQuery } from '../../../common/enums/file-status-query.enum';
import { SortOrder } from '../../../common/order.type';

export class GetWorkspaceFilesQueryDto extends LargePaginationDto {
  @IsOptional()
  @ApiProperty({
    required: false,
    enum: FileStatusQuery,
  })
  @IsEnum(FileStatusQuery)
  status?: FileStatusQuery;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  bucket?: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  sort?: SortableFileAttributes;

  @ApiProperty({
    required: false,
    enum: SortOrder,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;

  @IsOptional()
  @ApiProperty({
    required: false,
  })
  @IsDateString({}, { message: 'Invalid date format for updatedAt' })
  updatedAt?: string;
}
