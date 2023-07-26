import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/user.domain';
import { IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { PrivateSharingFolder } from '../private-sharing-folder.domain';
import { Folder } from '../../folder/folder.domain';
import { PrivateSharingFolderRole } from '../private-sharing-folder-roles.domain';

export class CreatePrivateSharingDto {
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ required: true })
  email: User['email'];

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ required: true })
  folderId: Folder['uuid'];

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ required: true })
  roleId: PrivateSharingFolderRole['id'];

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ required: true })
  encryptionKey: PrivateSharingFolder['encryptionKey'];
}
