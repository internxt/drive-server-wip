import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateFileMetaDto {
  @IsString()
  @ApiProperty({
    description: 'The plain text name of the file',
    example: 'example',
  })
  plainName: string;
}
