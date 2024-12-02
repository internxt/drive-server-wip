import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  ValidationArguments,
} from 'class-validator';
import { FileStatus, SortableFileAttributes } from '../../file/file.domain';
import { BasicPaginationDto } from '../../../common/dto/basic-pagination.dto';

const allowedStatuses = [...Object.values(FileStatus), 'ALL'];

export class GetWorkspaceFilesQueryDto extends BasicPaginationDto {
  @IsOptional()
  @IsEnum(allowedStatuses, {
    message: (args: ValidationArguments) =>
      `Invalid status provided: ${
        args.value
      }. Allowed values are: ${allowedStatuses.join(', ')}`,
  })
  status?: FileStatus | 'ALL';

  @IsOptional()
  @IsString()
  bucket?: string;

  @IsOptional()
  sort?: SortableFileAttributes;

  @IsOptional()
  @IsEnum(['ASC', 'DESC'], { message: 'Invalid order' })
  order?: 'ASC' | 'DESC';

  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format for updatedAt' })
  updatedAt?: string;
}
