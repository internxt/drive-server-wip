import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsPositive } from 'class-validator';
import { type User } from '../../user/user.domain';
import { type WorkspaceInvite } from '../domains/workspace-invite.domain';

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
    required: false,
  })
  @IsOptional()
  @IsPositive()
  spaceLimit?: WorkspaceInvite['spaceLimit'];

  @ApiProperty({
    example: 'encrypted encryption key',
    description:
      "Owner's encryption key encrypted with the invited user's public key.",
  })
  @IsNotEmpty()
  encryptionKey: WorkspaceInvite['encryptionKey'];

  @ApiProperty({
    example: 'Hello, join to my workspace',
    description: 'Message to include in the invitation.',
  })
  message?: string;

  @ApiProperty({
    example: 'aes-256-gcm',
    description: 'Encryption algorithm used to encrypt the encryption key.',
  })
  @IsNotEmpty()
  encryptionAlgorithm: WorkspaceInvite['encryptionAlgorithm'];
}
