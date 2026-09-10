import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import {
  CursorPaginationDto,
  CursorPageTokenDto,
} from '../../../common/dto/cursor-pagination.dto';

export class GetFolderContentFilesCursorDto extends CursorPaginationDto {
  @ApiProperty({
    description: 'Whether to include each file favorite status',
    default: false,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  withFavorites?: boolean;

  @ApiProperty({
    description: 'Whether to include each file thumbnails',
    default: false,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  withThumbnails?: boolean;

  @ApiProperty({
    description: 'Whether to include each file sharing info',
    default: false,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  withSharings?: boolean;
}

export class FolderFilesCursorDto extends CursorPageTokenDto {}
