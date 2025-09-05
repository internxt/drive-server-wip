import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MoveFileDto {
  @IsNotEmpty()
  @IsUUID()
  @ApiProperty({
    example: '366be646-6d67-436e-8cb6-4b275dfe1729',
    description: 'New Destination Folder UUID',
  })
  destinationFolder: string;

  @ApiProperty({
    description:
      'New file name (optional). Specify it to rename the file when moving, or send it empty to remove the current name.',
    required: false,
    example: 'newName',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description:
      'New file extension (optional). Specify it to change the extension when moving the file, or send it empty to remove the extension.',
    required: false,
    example: 'pdf',
  })
  @IsString()
  @IsOptional()
  type?: string;
}
