import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { FolderAttributes } from '../../folder/folder.domain';

export class StopSharingDto {
  @IsUUID()
  @ApiProperty({ required: true})
  folderId: FolderAttributes['uuid'];
}
