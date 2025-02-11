import { ApiProperty } from '@nestjs/swagger';
import { File } from 'src/modules/file/file.domain';

export class ResultFilesDto {
  @ApiProperty({ isArray: true, type: File })
  result: File[];
}
