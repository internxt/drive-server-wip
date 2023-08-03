import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { PrivateSharingFolder } from '../private-sharing-folder.domain';

export class StopSharingDto {
  @IsUUID()
  @ApiProperty({ required: true})
  privateFolderId: PrivateSharingFolder['id'];
}
