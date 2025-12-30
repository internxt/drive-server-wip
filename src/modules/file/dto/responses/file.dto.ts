import { ApiProperty } from '@nestjs/swagger';
import { FileStatus } from '../../file.domain';

export class FileDto {
  @ApiProperty()
  id: number;
  @ApiProperty()
  uuid: string;
  @ApiProperty({ nullable: true })
  fileId: string | null;
  @ApiProperty()
  name: string;
  @ApiProperty()
  type?: string;
  /**
   * When the client fetches it, size is converted to string, but openapi marks it as number.
   * This issue is related with how sequelize converts bigint to number.
   * https://github.com/internxt/drive-server-wip/pull/334
   */
  @ApiProperty({ type: String })
  size: bigint;
  @ApiProperty()
  bucket: string;
  @ApiProperty()
  folderId: number;
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

export class ExistentFilesDto {
  @ApiProperty({ isArray: true, type: FileDto })
  existentFiles: FileDto[];
}

export class ResultFilesDto {
  @ApiProperty({ isArray: true, type: FileDto })
  result: FileDto[];
}
