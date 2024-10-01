import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateFileMetaDto {
  @IsString()
  @ApiProperty({
    example: 'New name',
    description: 'The name the file is going to be updated to',
  })
  plainName: string;
}
