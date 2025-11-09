import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class OverrideUserLimitDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Limit ID to assign to the user',
  })
  @IsNotEmpty()
  @IsUUID()
  limitId: string;
}
