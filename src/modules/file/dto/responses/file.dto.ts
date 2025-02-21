import { ApiProperty } from '@nestjs/swagger';
import { FileStatus } from '../../file.domain';
import { IsNumber, IsString } from 'class-validator';

export class FileDto {
  @ApiProperty({
    description: 'The id of the file',
    example: 1,
    type: 'number',
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'The uuid of the file',
    example: 'a1b2c3d4-1234-5678-9abc-123456789abc',
    type: 'string',
  })
  @IsString()
  uuid: string;
  @ApiProperty({
    description: 'The fileId of the file',
    example: 'a1b2c3d4-1234-5678-9abc-123456789abc',
    type: String,
  })
  @IsString()
  fileId: string;
  @ApiProperty({
    description: 'The name of the file',
    example: 'file.txt',
    type: String,
  })
  @IsString()
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
