import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { FolderDto } from '../../../folder/dto/responses/folder.dto';
import { NetworkCredentialsDto, SharedItemBaseDto } from './shared-base.dto';

export class SharedFolderItemDto extends IntersectionType(
  FolderDto,
  SharedItemBaseDto,
) {
  @ApiProperty({
    description: 'Network credentials for accessing this folder',
    type: NetworkCredentialsDto,
    nullable: true,
  })
  credentials?: NetworkCredentialsDto | null;

  @ApiProperty({
    description: 'Access token for this folder',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    nullable: true,
  })
  token?: string | null;
}
