import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateFolderMetaDto {
  @IsString()
  @ApiProperty({
    description: 'The plain text name of the Folder',
    example: 'example',
  })
  plainName: string;
}
