import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    example: '123456',
    description: 'New max storage space in bytes',
  })
  @IsOptional()
  @IsNumber()
  maxSpaceBytes?: number;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Tier ID to update user tier (optional)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  tierId?: string;
}
