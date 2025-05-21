import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateFolderMetaDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'Untitled Folder',
    description: 'New name',
  })
  plainName: string;
}
