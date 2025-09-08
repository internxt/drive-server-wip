import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MoveFolderDto {
  @IsNotEmpty()
  @IsUUID()
  @ApiProperty({
    example: '366be646-6d67-436e-8cb6-4b275dfe1729',
    description: 'New Destination Folder UUID',
  })
  destinationFolder: string;

  @ApiProperty({
    description:
      'New folder name (optional). Specify it to rename the folder when moving',
    required: false,
    example: 'newName',
  })
  @IsString()
  @IsOptional()
  name?: string;
}
