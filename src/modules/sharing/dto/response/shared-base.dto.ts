import { ApiProperty } from '@nestjs/swagger';
import { type User } from '../../../user/user.domain';
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

export class SharingOwnerInfoDto {
  @ApiProperty({
    description: 'Bridge user',
    example: 'user@example.com',
  })
  bridgeUser: string;

  @ApiProperty({
    description: 'User id in the network',
    example: '$2a$08$...',
  })
  userId: string;

  @ApiProperty({
    description: 'User UUID',
    example: '5668e3bc-ae08-4c0b-b70c-efd55efe183c',
  })
  uuid: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  name: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  lastname: string;

  @ApiProperty({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  avatar: string | null;
}
