import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { PrivateSharingRole } from '../private-sharing-role.domain';

export class UpdatePrivilegesDto {
  @IsUUID()
  @ApiProperty({ required: true })
  roleId: PrivateSharingRole['id'];
}
