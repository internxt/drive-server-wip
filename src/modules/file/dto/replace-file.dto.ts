import { IsNotEmpty, IsPositive, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { File } from '../file.domain';

export class ReplaceFileDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    example: '651300a2da9b27001f63f384',
    description: 'File id',
  })
  fileId: File['fileId'];

  @IsPositive()
  @ApiProperty({
    example: '3005',
    description: 'New file size',
  })
  size: File['size'];
}
