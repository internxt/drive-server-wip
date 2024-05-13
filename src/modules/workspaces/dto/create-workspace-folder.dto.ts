import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
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
    description: 'Id of the parent folder',
  })
  @IsNotEmpty()
  parentFolderId: FolderAttributes['id'];
}
