import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsPositive } from 'class-validator';
import { User } from '../../user/user.domain';
import { WorkspaceInvite } from '../domains/workspace-invite.domain';

export class CreateWorkspaceInviteDto {
  @ApiProperty({
    example: 'invited_user@internxt.com',
    description: 'The email of the user you want to invite',
  })
  @IsNotEmpty()
  invitedUser: User['email'];

  @ApiProperty({
    example: '1073741824',
    description: 'Space assigned to user in bytes',
  })
  @IsNotEmpty()
  @IsPositive()
  spaceLimit: WorkspaceInvite['spaceLimit'];

  @ApiProperty({
    example: 'encrypted encryption key',
    description:
      "Owner's encryption key encrypted with the invited user's public key.",
  })
  @IsNotEmpty()
  encryptionKey: WorkspaceInvite['encryptionKey'];

  @ApiProperty({
    example: 'aes-256-gcm',
    description: 'Encryption algorithm used to encrypt the encryption key.',
  })
  @IsNotEmpty()
  encryptionAlgorithm: WorkspaceInvite['encryptionAlgorithm'];
}