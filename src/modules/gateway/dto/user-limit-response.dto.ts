import { ApiProperty } from '@nestjs/swagger';

export class UserLimitResponseDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Limit ID',
  })
  id: string;

  @ApiProperty({
    example: 'cli-access',
    description: 'Limit label',
  })
  label: string;

  @ApiProperty({
    example: 'boolean',
    description: 'Limit type (boolean or counter)',
  })
  type: string;

  @ApiProperty({
    example: 'true',
    description: 'Limit value',
  })
  value: string;

  constructor(partial: Partial<UserLimitResponseDto>) {
    Object.assign(this, partial);
  }
}
