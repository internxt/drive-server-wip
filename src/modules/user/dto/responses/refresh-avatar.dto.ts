import { ApiProperty } from '@nestjs/swagger';

export class RefreshUserAvatarDto {
  @ApiProperty({
    description: 'A new avatar URL for the given user',
  })
  avatar: string;
}
