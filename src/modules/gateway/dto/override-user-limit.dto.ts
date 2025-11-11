import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

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
}
