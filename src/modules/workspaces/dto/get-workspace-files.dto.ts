import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  ValidationArguments,
} from 'class-validator';
import { FileStatus, SortableFileAttributes } from '../../file/file.domain';
import { LargePaginationDto } from '../../../common/dto/basic-pagination.dto';
import { ApiProperty } from '@nestjs/swagger';

const allowedStatuses = [...Object.values(FileStatus), 'ALL'];

export class GetWorkspaceFilesQueryDto extends LargePaginationDto {
  @IsOptional()
  @ApiProperty({
    required: false,
    enum: allowedStatuses,
  })
  @IsEnum(allowedStatuses, {
    message: (args: ValidationArguments) =>
      `Invalid status provided: ${
        args.value
      }. Allowed values are: ${allowedStatuses.join(', ')}`,
  })
  status?: FileStatus | 'ALL';

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

  @IsOptional()
  @ApiProperty({
    required: false,
  })
  @IsEnum(['ASC', 'DESC'], { message: 'Invalid order' })
  order?: 'ASC' | 'DESC';

  @IsOptional()
  @ApiProperty({
    required: false,
  })
  @IsDateString({}, { message: 'Invalid date format for updatedAt' })
  updatedAt?: string;
}
