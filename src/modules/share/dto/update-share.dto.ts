import { ApiProperty } from '@nestjs/swagger';

export class UpdateShareDto {
  @ApiProperty({
    example: '4',
    description: 'Times to view valid, set null if unlimited',
  })
  timesValid: number;

  @ApiProperty({
    example: 'true',
    description: 'Share active or not',
  })
  active: boolean;
}
