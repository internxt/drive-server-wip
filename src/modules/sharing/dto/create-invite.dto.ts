import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { type SharingInvite } from '../sharing.domain';
import { type User } from '../../user/user.domain';

export class CreateInviteDto {
  @ApiProperty({
    example: '84f47d08-dc7c-43dc-b27c-bec4edaa9598',
    description: 'Id of the item to share',
  })
  @IsNotEmpty()
  itemId: SharingInvite['itemId'];

  @ApiProperty({
    example: 'file | folder',
    description: 'Type of the item being shared',
  })
  @IsNotEmpty()
  itemType: SharingInvite['itemType'];

  @ApiProperty({
    example: 'invited_user@internxt.com',
    description: 'The email of the user you want to invite',
  })
  @IsNotEmpty()
  sharedWith: User['email'];

  @ApiProperty({
    example: 'encrypted encryption key',
    description:
      'Owner\'s encryption key encrypted with the invited user\'s public key. This field should not be empty if the invitation type is "OWNER"',
  })
  encryptionKey: SharingInvite['encryptionKey'];

  @ApiProperty({
    example: 'aes-256-gcm',
    description:
      'Encryption algorithm used to encrypt the encryption key. This field should not be empty if the invitation type is "OWNER"',
  })
  encryptionAlgorithm: SharingInvite['encryptionAlgorithm'];

  @ApiProperty({
    example: 'encrypted encryption key',
    description:
      "Owner's encryption key encrypted with the invited user's public key",
  })
  @IsNotEmpty()
  type: SharingInvite['type'];

  @ApiProperty({
    example: '84f47d08-dc7c-43dc-b27c-bec4edaa9598',
    description: 'Invited user role regarding the item',
  })
  @IsNotEmpty()
  roleId: SharingInvite['roleId'];

  @ApiProperty({
    example: 'true | false',
    description: 'Request to send a notification to the invited user',
  })
  notifyUser: boolean;

  @ApiProperty({
    example: 'I want to share this file with you',
    description: 'Message to send into the notification for the invited user',
  })
  notificationMessage?: string;

  @ApiProperty({
    example: false,
    description: 'Maintain previous sharings',
  })
  persistPreviousSharing: boolean;
}
