import { ApiProperty } from '@nestjs/swagger';
import { FileDto } from './file.dto';

export class GetFilesSyncResponseDto {
  @ApiProperty({ type: FileDto, isArray: true })
  files: FileDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null;
}
