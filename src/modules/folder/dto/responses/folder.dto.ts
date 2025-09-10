import { ApiProperty } from '@nestjs/swagger';
import { Folder, FolderStatus } from '../../folder.domain';

export class FolderDto {
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
  @ApiProperty({ enum: FolderStatus })
  status: FolderStatus;
  @ApiProperty()
  removed: boolean;
  @ApiProperty()
  deleted: boolean;
}

export class FoldersDto {
  @ApiProperty({ isArray: true, type: FolderDto })
  folders: FolderDto[];
}

export class ExistentFoldersDto {
  @ApiProperty({ isArray: true, type: FolderDto })
  existentFolders: FolderDto[];
}

export class ResultFoldersDto {
  @ApiProperty({ isArray: true, type: FolderDto })
  result: FolderDto[];
}
