import { ApiProperty } from '@nestjs/swagger';
import { FolderDto } from './folder.dto';
import { FileDto } from 'src/modules/file/dto/responses/file.dto';

export class GetFolderContentDto extends FolderDto {
  @ApiProperty({ isArray: true, type: FolderDto })
  children: FolderDto[];
  @ApiProperty({ isArray: true, type: FileDto })
  files: FileDto[];
}
