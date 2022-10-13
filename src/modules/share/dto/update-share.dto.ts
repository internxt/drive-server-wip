import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

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

  @ApiProperty({
    example: 'a_sample_password_update_here',
    description: 'The new password for the share',
  })
  @IsOptional()
  plainPassword?: boolean;
}
