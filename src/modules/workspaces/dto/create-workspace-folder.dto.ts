import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { FolderAttributes } from '../../folder/folder.attributes';

export class CreateWorkspaceFolderDto {
  @ApiProperty({
    example: 'Untitled Folder',
    description: 'Folder name',
  })
  @IsNotEmpty()
  name: FolderAttributes['name'];

  @ApiProperty({
    example: '1',
    description: 'Uuid of the parent folder',
  })
  @IsNotEmpty()
  @IsUUID('4')
  parentFolderUuid: FolderAttributes['uuid'];
}