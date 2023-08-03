import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/user.domain';
import { IsEmail, IsNotEmpty, IsUUID } from 'class-validator';
import { Folder } from '../../folder/folder.domain';

export class UpdatePrivateSharingFolderRoleDto {
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ required: true, default: '' })
  email: User['email'];

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ required: true, default: '' })
  folderId: Folder['uuid'];
}
