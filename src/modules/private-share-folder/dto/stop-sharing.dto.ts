import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { Folder } from '../../folder/folder.domain';

export class StopSharingDto {
  @IsUUID()
  @ApiProperty({ required: true})
  folderUuid: Folder['uuid'];
}
