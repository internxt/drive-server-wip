import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class FolderItem {
  @ApiProperty({ example: 'Documents' })
  @IsNotEmpty()
  @IsString()
  plainName: string;

  @ApiProperty({ required: false, example: '2023-05-30T12:34:56.789Z' })
  @IsDateString()
  @IsOptional()
  modificationTime?: Date;

  @ApiProperty({ required: false, example: '2023-05-30T12:34:56.789Z' })
  @IsDateString()
  @IsOptional()
  creationTime?: Date;
}

export class CreateFolderDto {
  @ApiProperty({
    example: 'Untitled Folder',
    description: 'Folder name (required for single folder creation)',
    required: false,
  })
  @ValidateIf((o) => !o.folders)
  @IsNotEmpty()
  @IsString()
  plainName?: string;

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

  @ApiProperty({
    type: [FolderItem],
    required: false,
    description:
      'Array of folders to create in bulk (1-5 items). When provided, plainName is ignored.',
    minItems: 1,
    maxItems: 5,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => FolderItem)
  folders?: FolderItem[];
}
