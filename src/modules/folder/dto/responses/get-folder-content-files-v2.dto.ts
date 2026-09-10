import { ApiProperty } from '@nestjs/swagger';
import { FileDto } from '../../../file/dto/responses/file.dto';

export class GetFolderContentFilesV2ResponseDto {
  @ApiProperty({ type: FileDto, isArray: true })
  files: FileDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null;
}
