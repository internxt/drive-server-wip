import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { File } from '../file.domain';

export class MoveFileDto {
  @IsNotEmpty()
  @IsUUID()
  @ApiProperty({
    example: '366be646-6d67-436e-8cb6-4b275dfe1729',
    description: 'New Destination Folder UUID',
  })
  destinationFolder: File['folderUuid'];
}
