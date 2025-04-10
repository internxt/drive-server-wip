import { ApiProperty } from '@nestjs/swagger';
import { SharingType } from '../../sharing.domain';

export class PublicSharingInfoDto {
  @ApiProperty({
    description: 'Unique identifier of the public sharing record',
  })
  id: string;

  @ApiProperty({
    description:
      'Indicates if the public sharing requires a password to access',
  })
  isPasswordProtected: boolean;

  @ApiProperty({
    description: 'Encrypted public sharing password',
  })
  encryptedCode: string;
}

export class ItemSharingInfoDto {
  @ApiProperty({
    description:
      'Effective sharing type (PUBLIC or PRIVATE). If there are only pending invitations without an accepted sharing, it is considered PRIVATE',
    enum: SharingType,
  })
  type: SharingType;

  @ApiProperty({
    description:
      'Information about public sharing if it exists, otherwise null',
    type: PublicSharingInfoDto,
    nullable: true,
  })
  publicSharing: PublicSharingInfoDto | null;

  @ApiProperty({
    description: 'Number of pending invitations for this item',
  })
  invitationsCount: number;
}
