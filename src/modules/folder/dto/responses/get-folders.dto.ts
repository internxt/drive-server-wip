import { ApiProperty } from '@nestjs/swagger';
import { Folder, FolderStatus } from '../../folder.domain';

export class GetFoldersDto {
  @ApiProperty()
  type: string;
  @ApiProperty()
  id: number;
  @ApiProperty()
  parentId: number;
  @ApiProperty()
  parentUuid: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  parent?: Folder;
  @ApiProperty()
  bucket?: string;
  @ApiProperty()
  userId: number;
  @ApiProperty()
  encryptVersion?: '03-aes';
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
  @ApiProperty()
  uuid: string;
  @ApiProperty()
  plainName: string;
  @ApiProperty()
  size: number;
  @ApiProperty()
  creationTime: Date;
  @ApiProperty()
  modificationTime: Date;
  @ApiProperty()
  status: FolderStatus;
}

export class ResultGetFoldersDto {
  @ApiProperty({ isArray: true, type: GetFoldersDto })
  result: GetFoldersDto[];
}
