import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  type ValidationArguments,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LargePaginationDto } from '../../../common/dto/basic-pagination.dto';
import {
  FolderStatus,
  SortableFolderAttributes,
} from '../../folder/folder.domain';

const allowedStatuses = [...Object.values(FolderStatus), 'ALL'];

export class GetWorkspaceFoldersQueryDto extends LargePaginationDto {
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
