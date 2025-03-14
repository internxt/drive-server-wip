import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    example: '123456',
    description: 'New max storage space in bytes',
  })
  @IsNotEmpty()
  @IsNumber()
  maxSpaceBytes: number;
}
