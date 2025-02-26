import { IsNotEmpty, IsPositive, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReplaceFileDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    example: '651300a2da9b27001f63f384',
    description: 'File id',
  })
  fileId: string;

  @IsPositive()
  @ApiProperty({
    example: '3005',
    description: 'New file size',
  })
  size: bigint;
}
