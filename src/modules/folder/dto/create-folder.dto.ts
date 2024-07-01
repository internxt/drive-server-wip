import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { FolderAttributes } from '../../folder/folder.attributes';

export class CreateFolderDto {
  @ApiProperty({
    example: 'Untitled Folder',
    description: 'Folder name',
  })
  @IsNotEmpty()
  plainName: FolderAttributes['plainName'];

  @ApiProperty({
    example: '79a88429-b45a-4ae7-90f1-c351b6882670',
    description: 'Uuid of the parent folder',
  })
  @IsNotEmpty()
  @IsUUID('4')
  parentFolderUuid: FolderAttributes['uuid'];
}
