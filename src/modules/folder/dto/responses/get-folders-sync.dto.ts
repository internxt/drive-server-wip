import { ApiProperty, OmitType } from '@nestjs/swagger';
import { FolderDto } from './folder.dto';

export class FolderSyncDto extends OmitType(FolderDto, ['isFavorite']) {}

export class GetFoldersSyncResponseDto {
  @ApiProperty({ type: FolderSyncDto, isArray: true })
  folders: FolderSyncDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null;
}
