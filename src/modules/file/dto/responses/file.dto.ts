import { ApiProperty } from '@nestjs/swagger';
import { FileStatus } from '../../file.domain';

export class FileDto {
  @ApiProperty()
  id: number;
  @ApiProperty()
  uuid: string;
  @ApiProperty()
  fileId: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  type?: string;
  @ApiProperty()
  size: bigint;
  @ApiProperty()
  bucket: string;
  @ApiProperty()
  folderId: number;
  @ApiProperty()
  folder?: any;
  @ApiProperty()
  folderUuid: string;
  @ApiProperty()
  encryptVersion: string;
  @ApiProperty()
  userId: number;
  @ApiProperty()
  creationTime: Date;
  @ApiProperty()
  modificationTime: Date;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
  @ApiProperty()
  plainName: string;
  @ApiProperty({ enum: FileStatus })
  status: FileStatus;
}

export class FilesDto {
  @ApiProperty({ isArray: true, type: FileDto })
  files: FileDto[];
}

export class ResultFilesDto {
  @ApiProperty({ isArray: true, type: FileDto })
  result: FileDto[];
}
