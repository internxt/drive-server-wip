import { ApiProperty } from '@nestjs/swagger';
import { Folder } from '../folder.domain';

export class ResultFoldersDto {
  @ApiProperty({ isArray: true, type: Folder })
  result: Folder[];
}
