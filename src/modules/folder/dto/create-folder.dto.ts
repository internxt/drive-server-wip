import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateFolderDto {
  @ApiProperty({
    example: 'Untitled Folder',
    description: 'Folder name',
  })
  @IsNotEmpty()
  plainName: string;

  @ApiProperty({
    example: '79a88429-b45a-4ae7-90f1-c351b6882670',
    description: 'Uuid of the parent folder',
  })
  @IsNotEmpty()
  @IsUUID('4')
  parentFolderUuid: string;

  @ApiProperty({
    description: 'The last modification time of the folder (optional)',
    required: false,
    example: '2023-05-30T12:34:56.789Z',
  })
  @IsDateString()
  @IsOptional()
  modificationTime?: Date;

  @ApiProperty({
    description: 'The creation time of the folder (optional)',
    required: false,
    example: '2023-05-30T12:34:56.789Z',
  })
  @IsDateString()
  @IsOptional()
  creationTime?: Date;
}
