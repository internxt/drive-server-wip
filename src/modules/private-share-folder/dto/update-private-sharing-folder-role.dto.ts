import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/user.domain';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { Folder } from '../../folder/folder.domain';

export class UpdatePrivateSharingFolderRoleDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ required: true, default: '' })
  userId: User['uuid'];

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ required: true, default: '' })
  folderId: Folder['uuid'];
}
