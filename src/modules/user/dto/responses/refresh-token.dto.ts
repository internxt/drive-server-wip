import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenResponseDto {
  @ApiProperty({
    description: 'The old token that has been replaced',
    example: 'newToken1234567890',
  })
  token: string;

  @ApiProperty({
    description: 'The new token to be used for authentication',
    example: 'oldToken1234567890',
  })
  newToken: string;
}
