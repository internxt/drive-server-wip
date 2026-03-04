import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { type SharingRole } from '../sharing.domain';

export class UpdateSharingRoleDto {
  @ApiProperty({
    example: '84f47d08-dc7c-43dc-b27c-bec4edaa9598',
    description: 'New role id',
  })
  @IsNotEmpty()
  roleId: SharingRole['roleId'];
}
