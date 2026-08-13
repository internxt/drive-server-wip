import { ApiProperty, OmitType } from '@nestjs/swagger';
import { FileDto } from './file.dto';

export class FileSyncDto extends OmitType(FileDto, ['thumbnails', 'isFavorite']) {}

export class GetFilesSyncResponseDto {
  @ApiProperty({ type: FileSyncDto, isArray: true })
  files: FileSyncDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null;
}
