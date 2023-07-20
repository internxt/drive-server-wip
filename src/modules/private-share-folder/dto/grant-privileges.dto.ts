import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { User } from 'src/modules/user/user.domain';
import { PrivateSharingFolder } from '../private-sharing-folder.domain';
import { PrivateSharingRole } from '../private-sharing-role.domain';

export class GrantPrivilegesDto {
  @IsUUID()
  @ApiProperty({ required: true })
  userUuid: User['uuid'];

  @IsUUID()
  @ApiProperty({ required: true })
  privateFolderId: PrivateSharingFolder['id'];

  @IsUUID()
  @ApiProperty({ required: true })
  roleId: PrivateSharingRole['id'];
}
