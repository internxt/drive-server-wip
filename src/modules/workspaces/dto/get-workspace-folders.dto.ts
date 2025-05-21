import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  ValidationArguments,
} from 'class-validator';
import { BasicPaginationDto } from '../../../common/dto/basic-pagination.dto';
import {
  FolderStatus,
  SortableFolderAttributes,
} from '../../storage/folder/folder.domain';

const allowedStatuses = [...Object.values(FolderStatus), 'ALL'];

export class GetWorkspaceFoldersQueryDto extends BasicPaginationDto {
  @IsOptional()
  @IsEnum(allowedStatuses, {
    message: (args: ValidationArguments) =>
      `Invalid status provided: ${
        args.value
      }. Allowed values are: ${allowedStatuses.join(', ')}`,
  })
  status?: FolderStatus | 'ALL';

  @IsOptional()
  @IsString()
  bucket?: string;

  @IsOptional()
  sort?: SortableFolderAttributes;

  @IsOptional()
  @IsEnum(['ASC', 'DESC'], { message: 'Invalid order' })
  order?: 'ASC' | 'DESC';

  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format for updatedAt' })
  updatedAt?: string;
}
