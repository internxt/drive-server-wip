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

  @ApiProperty({
    description:
      'Date when the file was last modified before this version was created',
  })
  modificationTime: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({
    description: 'Date when this version expires based on retention policy',
  })
  expiresAt: Date;
}

export class FileVersionsDto {
  @ApiProperty({ isArray: true, type: FileVersionDto })
  versions: FileVersionDto[];
}
