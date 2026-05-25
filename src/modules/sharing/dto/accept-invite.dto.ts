import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
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

  @ApiProperty({
    example: '84f47d08-dc7c-43dc-b27c-bec4edaa9598',
    description:
      'Role to assign to the requester (required when the invitation is a request)',
  })
  @IsOptional()
  @IsUUID()
  roleId?: string;
}
