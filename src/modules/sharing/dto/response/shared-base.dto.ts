import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../../user/user.domain';
import { Sharing } from '../../sharing.domain';

export class NetworkCredentialsDto {
  @ApiProperty({
    description: 'Network password for the user',
    example: 'user123',
  })
  networkPass: User['userId'];

  @ApiProperty({
    description: 'Bridge user identifier',
    example: 'bridge_user_123',
  })
  networkUser: User['bridgeUser'];
}

export class SharedItemBaseDto {
  @ApiProperty({
    description: 'Encryption key for the shared item',
    example: 'abc123def456',
    nullable: true,
  })
  encryptionKey: Sharing['encryptionKey'] | null;

  @ApiProperty({
    description: 'Date when the item was shared',
    example: '2024-01-15T10:30:00Z',
    nullable: true,
  })
  dateShared: Date | null;

  @ApiProperty({
    description: 'Whether this item is shared with the current user',
    example: true,
    nullable: true,
  })
  sharedWithMe: boolean | null;

  @ApiProperty({
    description: 'Sharing identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  sharingId?: Sharing['id'] | null;
}
