import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import {
  CursorPaginationDto,
  CursorPageTokenDto,
} from '../../../common/dto/cursor-pagination.dto';

export class GetFolderContentFoldersCursorDto extends CursorPaginationDto {
  @ApiProperty({
    description: 'Whether to include each folder favorite status',
    default: false,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  withFavorites?: boolean;

  @ApiProperty({
    description: 'Whether to include each folder sharing info',
    default: false,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  withSharings?: boolean;
}

export class FolderFoldersCursorDto extends CursorPageTokenDto {}
