import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { SharingInvite, SharingRole } from '../sharing.domain';
import { User } from '../../user/user.domain';

export class CreateSharingRoleDto {
  @ApiProperty({
    example: '84f47d08-dc7c-43dc-b27c-bec4edaa9598',
    description: 'Id of the sharing where the role is being created',
  })
  @IsNotEmpty()
  sharingId: SharingRole['sharingId'];

  @ApiProperty({
    example: 'aes-256-gcm',
    description:
      'Encryption algorithm used to encrypt the encryption key. This field should not be empty if the invitation type is "OWNER"',
  })
  roleId: SharingRole['roleId'];
}
