import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class OverrideUserLimitDto {
  @ApiProperty({
    example: 'cli',
    description: 'Feature name',
  })
  @IsNotEmpty()
  @IsString()
  feature: string;

  @ApiProperty({
    example: 'true',
  })
  @IsNotEmpty()
  @IsString()
  value: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Tier ID to update a feature (optional)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  tierId?: string;
}
