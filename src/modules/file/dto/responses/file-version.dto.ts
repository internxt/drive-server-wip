import { ApiProperty } from '@nestjs/swagger';
import { FileVersionStatus } from '../../file-version.domain';

export class FileVersionDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  fileId: string | null;

  @ApiProperty()
  networkFileId: string;

  @ApiProperty({ type: String })
  size: bigint;

  @ApiProperty({ enum: FileVersionStatus })
  status: FileVersionStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class FileVersionsDto {
  @ApiProperty({ isArray: true, type: FileVersionDto })
  versions: FileVersionDto[];
}
