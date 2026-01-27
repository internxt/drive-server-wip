import { Type } from 'class-transformer';
import {
  IsString,
  ArrayMaxSize,
  IsOptional,
  IsNotEmpty,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FilesNameAndType {
  @ApiProperty({
    description: 'Type of file',
    example: 'pdf',
    required: false,
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({
    description: 'Plain name of file',
    example: 'example',
  })
  @IsString()
  plainName: string;
}

export class CheckFileExistenceInFolderDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'Array of files with names and types',
    isArray: true,
    type: FilesNameAndType,
  })
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested()
  @Type(() => FilesNameAndType)
  files: FilesNameAndType[];
}
