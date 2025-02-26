import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateWorkspaceFolderDto {
  @ApiProperty({
    example: 'Untitled Folder',
    description: 'Folder name',
  })
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '79a88429-b45a-4ae7-90f1-c351b6882670',
    description: 'Uuid of the parent folder',
  })
  @IsNotEmpty()
  @IsUUID('4')
  parentFolderUuid: string;
}
