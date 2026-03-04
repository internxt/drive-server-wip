import { ApiProperty } from '@nestjs/swagger';
import { type SharingInvite } from '../sharing.domain';

export class AcceptInviteDto {
  @ApiProperty({
    example: 'encryption_key',
    description: 'Encryption key (just in case the invitation is a request)',
  })
  encryptionKey?: SharingInvite['encryptionKey'];

  @ApiProperty({
    example: 'encryption_algorithm',
    description:
      'Encryption algorithm (just in case the invitation is a request)',
  })
  encryptionAlgorithm?: SharingInvite['encryptionAlgorithm'];
}
