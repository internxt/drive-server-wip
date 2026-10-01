import { ApiProperty } from '@nestjs/swagger';
import { FolderDto } from './folder.dto';

export class GetFolderContentFoldersV2ResponseDto {
  @ApiProperty({ type: FolderDto, isArray: true })
  folders: FolderDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null;
}
